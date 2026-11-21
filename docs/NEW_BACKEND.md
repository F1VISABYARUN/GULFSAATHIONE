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

## Storage and cron (added)
- **Storage picks itself:**
  - Upstash Redis if `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set (Vercel KV's `KV_REST_API_URL` and `KV_REST_API_TOKEN` also work).
  - Otherwise memory on Vercel, or a JSON file locally.
  - Add Upstash from Vercel → Storage → Marketplace; it fills the variables.
- **Cron:** `vercel.json` runs `GET /api/saathi/cron` **once a day** (03:30 UTC), because Vercel's Hobby plan allows only daily crons; an hourly schedule failed the deploy. For arrival calls within hours, point a free external cron (e.g. cron-job.org) at `/api/saathi/cron` every 15–60 minutes with header `Authorization: Bearer $CRON_SECRET`.

### Family SMS
On first entry into high/critical risk, reserve one notification for the family phone. Configure MSG91_AUTH_KEY and MSG91_TEMPLATE_ID with an approved Telugu template matching familyMessage and a single case_id variable. Family phone numbers must include their country code. The worker record holds familySms.sentAt (attempt time) and status. Missing settings produce dry-run. Provider acceptance is not delivery confirmation. Pending/failed attempts require operator reconciliation before any manual resend. Run a single process for file storage or use Redis for shared workers.

### Caseworker JSON API
Use the existing SAATHI_SECRET header (x-saathi-secret). GET /api/saathi/cases supports optional level and status filters. POST /api/saathi/cases/:id/note takes {"note":"..."}. POST /api/saathi/cases/:id/close takes {"outcome":"solved"}; partly, not and withdrawn are also valid. Closing again with the same outcome returns the original closure.

### Escalation clock
The case list computes overdue for open high/critical cases at 24 hours since escalation or the latest caseworker note, whichever is later. For historical workers without an escalation timestamp, creation time is the fallback.

### Case file
GET /api/saathi/cases/:id/file returns the shared case-file JSON built from the worker’s promise and chronological calls. Provider transcripts contribute caller speech with question context. Missed calls contribute no speech evidence.

### Bolna outbound calls
POST https://api.bolna.ai/call with Authorization: Bearer BOLNA_API_KEY. Send agent_id (BOLNA_CHECKIN_AGENT_ID), recipient_phone_number in E.164, and user_data with the worker context and actual call kind. Optional BOLNA_FROM_PHONE_NUMBER sets from_phone_number. A successful queue response supplies execution_id; this is distinct from an answered call. Missing key or agent stays dry-run. Contract cross-checked with [Bolna’s maintained integration](https://github.com/bolna-ai/n8n-nodes-bolna/blob/main/nodes/Bolna/Bolna.node.ts); direct access to docs.bolna.ai was blocked in this environment.
