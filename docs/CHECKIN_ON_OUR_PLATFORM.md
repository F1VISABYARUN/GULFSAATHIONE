# Check-in calls on our own platform (no Bolna)

The scheduled calls (arrival, weekly, briefing, alert, retry) are placed by our server through Plivo and run on the call server (AWS).
Nothing is re-written: the script, welcome line and tool list are the Bolna Check-in agent's own (`checkin` and `tools` in `bolna/agents.ts`).

## How a call runs
1. The scheduler (`/api/saathi/cron`, daily 03:30 UTC, or `/api/saathi/scheduler/tick`) decides who is due, as before.
2. `placeCall` asks Plivo to call the worker from your number; Plivo fetches `<INTERPRETER_ORIGIN>/answer?mode=checkin&case_id=...&kind=...`.
3. The call server reads the case (`/api/saathi/checkin-context/:id`: name, employer, job, destination, safety phrase), says the Bolna welcome line and runs the script with the same tools (`record_checkin`, `find_place`, `directions`, `translate`, `exit_path`).
4. `record_checkin` saves the answers and escalates danger exactly as before. The call ends only after the answers were saved (or on the worker's goodbye / hang-up).
5. Plivo's hangup callback (`/webhooks/plivo-status`) records unanswered calls as missed so the scheduler retries them (replaces Bolna's post-call webhook).
6. Danger on a Check-in call: the case is recorded and the Telugu instruction is said; the call stays with the worker (no transfer), like the Bolna script.

## Settings (Vercel app environment)
| Name | Value |
|---|---|
| `PLIVO_AUTH_ID`, `PLIVO_AUTH_TOKEN` | from the Plivo console (main account). Enter them in Vercel yourself |
| `INTERPRETER_ORIGIN` | the call server's public origin, e.g. `https://dxxxx.cloudfront.net` (no trailing slash) |
| `PLIVO_FROM_NUMBER` | the number to call from, E.164, e.g. `+918065952403` |
| `SAATHI_BASE_URL` | optional; the app's own origin for Plivo's hangup callback (default `https://gulfsaathione.vercel.app`) |
| `CHECKIN_VIA=bolna` | optional; keeps using Bolna instead (needs `BOLNA_API_KEY`, `BOLNA_CHECKIN_AGENT_ID`) |

Without the four Plivo settings the scheduler falls back to Bolna, then to a dry run. The call server needs the settings it already has (`SAATHI_URL`, `SAATHI_SECRET`, `PLIVO_AUTH_TOKEN`, keys).

## Try one call now
1. Register a case with your own number (Vercel app, with the secret header):
   `POST /api/saathi/workers` `{"name":"Suresh","phone":"+91XXXXXXXXXX","consent":true,"employerName":"Al Noor","job":"cleaner","destCity":"Dubai","destCountry":"UAE","codePhrase":"amma bagunda"}`
2. Place the call: `POST /api/saathi/cases/<caseId>/call` `{"kind":"arrival"}` (or `weekly`, `briefing`).
3. Answer: you hear "నమస్కారం Suresh గారు, నేను సాథి నుండి మాట్లాడుతున్నాను." Say "హలో"; it asks the first question of that call type.

## Not verified
Never run on a real call; Plivo's hangup field names (`CallStatus`, `Duration`) are from memory; the Bolna Sarvam "Ashutosh" voice is not used (Cartesia Telugu voice instead); outbound-call rules for your Plivo account and number in India; native-speaker review of the script wording. Calls beyond one at a time are untested.
