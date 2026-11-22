# Gulf Saathi: setup and test guide (for people and AI agents)

Gulf Saathi is Telugu phone support for workers going to the Gulf and their families. It checks recruitment details against government data, records what an agent promised, flags risk, creates a case file for a caseworker, and (on a phone call) can speak Arabic on a Telugu worker's behalf after the worker approves each message.

**Everything below runs with no API keys.** Features that need paid phone or AI services (live calls, speech, maps, SMS) are listed separately under "Needs provider keys" and are shown by the live deployment, not by a fresh install.

## Prerequisites
- Node.js 22 (`node -v` shows v22.x) and npm. Nothing else is required for the journeys below.
- Optional: `ffmpeg` (only for audio features), Docker (only to build the images in `Dockerfile` / `Dockerfile.interpreter`).

## Install and start (about 1 minute)
```bash
npm ci
export STORE=memory SAATHI_SECRET=demo-secret PORT=3000
npx tsx server/index.ts
```
Leave it running. It prints `Gulf Saathi harness on http://localhost:3000`. Data is kept in memory and resets when it restarts.

Run the tests (about 1 minute, no keys needed; the expected result is `# fail 0`):
```bash
npm test
npx tsc --noEmit
```

## How to confirm it works
After starting, `curl -s localhost:3000/api/health` returns `{"ok":true,"hasKey":false,...}`, and `npm test` ends with `# pass 199` and `# fail 0`. `hasKey:false` is correct without an OpenAI key.

## Test login
There are no user accounts. Private API routes and the caseworker page use one access key, sent as the `x-saathi-secret` header. With the start command above the key is **`demo-secret`**. On the caseworker page (`/caseworker.html`) type `demo-secret` into the access key box.

## Journeys to try, end to end (all work locally without keys)
Open `http://localhost:3000`.

1. **Website (English and Telugu).** `/` is the public site. Use the language button (top right) to switch to Telugu. Scroll through: worker journey, risk layer, test call audio, languages roadmap. `/data.html` explains each government dataset (real numbers computed from the data files), why it is needed, and its limits.
2. **Register a worker and get pre-departure warnings.**
   ```bash
   curl -s -H x-saathi-secret:demo-secret -H content-type:application/json \
     -d '{"phone":"+919000000001","consent":true,"name":"Demo Worker","caseId":"GS-DEMO1","destCountry":"Saudi Arabia","promise_said":"cleaner job Riyadh, agent said fifty thousand rupees, visit visa"}' \
     http://localhost:3000/api/saathi/workers
   ```
   Expect `preDepartureWarnings` containing `VISIT_VISA` (a visit visa offered for work).
3. **Check an agent against the government list.**
   ```bash
   curl -s -H x-saathi-secret:demo-secret -H content-type:application/json -d '{"agency":"Ramesh"}' http://localhost:3000/tools/check-agent
   ```
   Expect `status` of `registered`, `not_found` or `flagged` and a Telugu instruction. The list is the MEA active RA list (data file `server/data/ra_list.json`, 2,388 agents).
4. **Check a fee against the legal limit.** `POST /tools/check-fee` with `{"caller_said":"ninety thousand rupees"}`. If the amount is not understood it returns `needs_confirm` and asks again. This is deliberate: a misheard number is never trusted.
5. **Report a problem: danger escalates to a case file.**
   ```bash
   curl -s -H x-saathi-secret:demo-secret -H content-type:application/json \
     -d '{"case_id":"GS-DEMO1","caller_said":"they took my passport and I have no food"}' http://localhost:3000/tools/report-problem
   ```
   Expect `level: critical` with reasons `DISTRESS` and `PASSPORT_HELD`.
6. **Caseworker desk.** Open `/caseworker.html`, enter `demo-secret`, open case `GS-DEMO1`: case file, timeline, acknowledge, notes, close. API equivalent: `GET /api/saathi/cases` and `GET /api/saathi/cases/GS-DEMO1/file` with the header.
7. **Visa-ending plan (Exit Path).** Send structured fields: `POST /tools/exit-path` with `{"country":"UAE","visa_type":"visit visa","expiry":"2026-12-10"}`. Expect `daysLeft`, a digit-by-digit `readBack` of the date and a next question (`status: ask`) or a plan. It only states fines and fees read on official pages; anything else it says it cannot confirm and refers to the embassy. Data: `server/data/exit_rules.json`. Note: the free-text field `caller_said` is built for Telugu speech; short English sentences it does not recognise are treated as possible danger and escalate to a human (a deliberate safe default).
8. **Speech-to-text harness in text mode.** `/harness.html` (or `POST /api/analyze-text` with `{"text":"..."}`): paste what a speech model heard, such as Telugu or English money, phone numbers and negations ("ivvaledu" = "did not give"), and see the corrected reading and risks.
   Expected and harmless: the browser console shows one 404 for `/api/results` on this page, because the speech-model benchmark results file is not included in the zip.
9. **Call-me form.** `GET /api/call-me/status` returns `{"mode":"closed"}` without Plivo settings: the form on the home page then says calls are not open. This is expected in a fresh install.

## Environment variables
None are required for the journeys above. Optional, for live features:

| Variable | Used for |
|---|---|
| `SAATHI_SECRET` | access key for private routes (set to `demo-secret` locally) |
| `STORE` | `memory` (default for local), or Upstash Redis via `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` |
| `OPENAI_API_KEY` | speech-to-text, translation, voice agent |
| `PLIVO_AUTH_ID`, `PLIVO_AUTH_TOKEN`, `PLIVO_FROM_NUMBER`, `INTERPRETER_ORIGIN` | phone calls (website "Get a call" form and check-in calls) |
| `SAATHI_BASE_URL`, `CRON_SECRET` | public address of this backend; daily check-in job |
| `GOOGLE_MAPS_API_KEY` | nearest police station / pharmacy / embassy |
| `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID` | family SMS (dry-run without them) |
| `CALL_ME_PER_NUMBER_PER_DAY`, `CALL_ME_NET_PER_HOUR`, `CALL_ME_DAILY_MAX`, `CALL_ME_ALLOWLIST` | limits for the public call form |

See `deploy/backend.env.example`.

## Needs provider keys (not runnable from a fresh zip)
- **Phone call server** (`interpreter/`): answers calls from Plivo, listens in Telugu, asks the worker to approve each message before speaking Arabic, tells the worker what was said. Start with `npx tsx interpreter/server.ts` (needs `INTERPRETER_ORIGIN`, `SAATHI_URL`, `SAATHI_SECRET`, `PLIVO_AUTH_ID`, `PLIVO_AUTH_TOKEN`, `INTERPRETER_HUMAN_NUMBER`, `OPENAI_API_KEY`; Sarvam and Cartesia keys improve Telugu hearing and voice). It runs on AWS EC2 behind CloudFront. Deploy steps: `docs/AWS_RUNBOOK.md`, `docs/AWS_BACKEND.md`, `scripts/aws-deploy.sh`.
- **Live deployment for judges:** public site `https://d2kq7o4x2k0pos.cloudfront.net/` (AWS) and phone line **+91 80659 52403**. The "Get a call" form on the site asks Gulf Saathi to phone the visitor's number. These are provided as evidence of the live system; availability depends on the hosting account and phone balance.

## What is verified and what is not
- Verified by tests (`npm test`): harness (numbers, negation, terms), risk rules, fee cap, agent check, exit-path rules, case desk, call-me limits, website content, phone-call state machine with simulated speech.
- Verified on real calls: the call server answers, greets in Telugu, hears Telugu, handles interruptions, looks up a police station from a landmark, and after the worker's "సరే" speaks Arabic with an AI-disclosure line.
- Not verified: Arabic voice quality, Arabic speech from a real Arabic speaker translated back to Telugu, calls with many callers at once, native-speaker review of Telugu and Arabic wording, and the outbound check-in call end to end.
- Government figures come from the files in `server/data/` (retrieval dates are in each file). The agent list is read automatically from a PDF and may contain reading mistakes; a missing name is not proof an agent is illegal.

## Layout
`server/` backend (Express, TypeScript) · `server/harness/` speech-reading rules · `server/exit/` visa-ending rules · `server/data/` government and research data · `interpreter/` phone call server · `public/` website and caseworker page · `tests/` · `docs/` design and runbooks · `python/` Python port of the harness · `scripts/` deploy helpers.
