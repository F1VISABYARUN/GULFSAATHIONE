# Gulf Saathi — new backend (built from scratch for the hackathon)

All code here is new. Nothing is reused from the earlier gulf-saathi repo or website.

| Endpoint | Who calls it | What it does |
|---|---|---|
| `POST /api/saathi/workers` | caseworker / intake | Registers a worker (phone, consent, employer, job, safety phrase, departure date). The promise is read **in his own words** through the harness. It warns before departure: visit visa, fee above ₹35,400. |
| `GET /api/saathi/workers/:caseId` | caseworker | The worker, his risk level and reasons, and every call. |
| `POST /tools/check-agent` | Bolna tool | Checks the official MEA registered-agent list, district-aware, and returns the Telugu line to say. Never says an agent is "safe". |
| `POST /tools/check-fee` | Bolna tool | Adds up payments against the ₹35,400 cap. If the caller's own words (`caller_said`) disagree with the LLM's numbers, it asks him to confirm. |
| `POST /tools/report-problem`, `/tools/record-checkin` | Bolna tools | Runs the harness on `caller_said`. The LLM's yes/no fields can add danger but never remove it. Returns the level, the reasons and a Telugu instruction. The safety phrase is never echoed. |
| `POST /webhooks/saathi` | Bolna (post-call) | Safety net on the full transcript, with questions as context. Records missed calls. |
| `POST /api/saathi/scheduler/tick` | cron (every 15–60 min) | Books calls: arrival (6 h after the flight), a retry after a miss (3 h before the first answer, 24 h after), and weekly. It places the call through Bolna when `BOLNA_API_KEY` and `BOLNA_CHECKIN_AGENT_ID` are set; otherwise it's a dry run. |

Storage is a JSON file by default. Use `STORE=memory` on Vercel, where the disk is read-only, until a database is added.

**To verify:**
- **Call API:** check the endpoint and fields in Bolna's docs (`POST /call` with `agent_id`, `recipient_phone_number` and `user_data`).
- **Tool parameter:** add `caller_said` ("the caller's exact words") to each Bolna tool.

## New Bolna agents (created 2026-11-21, separate from the old ones)

The old "Gulf Saathi" and "Saathi Check-in agent" were not changed.

| Agent | ID | Points to |
|---|---|---|
| Saathi Harness Helpline (hackathon) | `209a9a4e-aea2-4094-ba33-0fbda791bb4c` | `/tools/check-agent`, `/tools/check-fee`, `/tools/report-problem`, webhook `/webhooks/saathi` |
| Saathi Harness Check-in (hackathon) | `21c64ea5-5b61-4988-bcdf-4b340ca77778` | `/tools/record-checkin`, webhook `/webhooks/saathi` |

**How they're set up:**
- Speech-to-text: Sarvam `saaras:v3` with **language `te`**, plus keywords.
- Voice: Sarvam `bulbul:v3`, Telugu.
- Every tool sends `caller_said`, the caller's exact words, so the harness reads them itself.
- Endpointing: 400 ms.

**After deploying to Vercel:**
1. Replace `https://YOUR-SAATHI-HARNESS.vercel.app` in both agents' tool URLs and webhook with the real URL.
2. Set `BOLNA_CHECKIN_AGENT_ID=21c64ea5-5b61-4988-bcdf-4b340ca77778`.
3. Test one call. **Things to check:**
   - The Telugu voice: Ashutosh with language `te` is untested; switch to a Telugu voice in the dashboard if it sounds wrong.
   - Whether the welcome message's `{worker_name}` gets filled in.
