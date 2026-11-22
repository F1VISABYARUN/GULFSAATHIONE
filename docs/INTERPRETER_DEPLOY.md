# Deploying the phone interpreter

Untested on a real call. Vercel cannot hold WebSockets, so this runs on a container host (AWS or any other).

Build: `docker build -f Dockerfile.interpreter -t saathi-interpreter .`

Required env: `INTERPRETER_ORIGIN` (public HTTPS origin, no path), `SAATHI_URL` (the Vercel app), `SAATHI_SECRET`,
`PLIVO_AUTH_ID`, `PLIVO_AUTH_TOKEN`, `INTERPRETER_HUMAN_NUMBER` (E.164), `OPENAI_API_KEY`; optional `INTERPRETER_TARGET` (default `ar`).

AWS sketch (not run): ECS Fargate service behind an Application Load Balancer (supports WebSockets), CloudFront in front for HTTPS on a
`*.cloudfront.net` name. The Plivo signature is computed over `INTERPRETER_ORIGIN`, so it must equal the host Plivo calls.
A Workshop Studio account is temporary and may restrict services.

Plivo: point a number's answer URL (GET) at `<origin>/answer?case_id=GS-XXXX`. Keypad: 1 Telugu speaker, 2 other speaker, # end turn, 3 confirm, 0 stop.

## Agent mode (default) and keypad mode
Default `INTERPRETER_MODE=agent` (override per call with `/answer?mode=keypad`). The worker talks to Saathi by voice: states a goal in Telugu,
Saathi speaks to the other person in `INTERPRETER_TARGET` on the worker's behalf, and reports their answer back in Telugu. The phone is on speaker,
so both people hear both languages. The speaker is told apart by script (Telugu letters = worker), so the target language must not be Telugu-script.
Code, not the model, enforces: no number nobody said, no number dropped from the Telugu report, no reply to an amount until the worker answers.
Key 0 stops the call. Model: `INTERPRETER_AGENT_MODEL` (default gpt-4.1). Consent is the spoken disclosure at the start, not keypad consent: review this before real use.

## Keypad-mode behaviour
- A flagged amount or distress word is read back to its speaker first; key 3 releases that exact text for translation.
- The Telugu back-translation must keep negation and amounts (`meaningKept` in `server/relay.ts`) or the turn is refused.
- A case's private phrase never transfers the call: the desk is alerted silently via `/tools/record-checkin` and the turn sounds like an ordinary repeat request.
- A failed transfer alerts the desk and keeps the worker on the line. `/human-result` logs what Plivo reports (`DialStatus`, name unverified);
  anything but `completed` redirects the caller back to the interpreter. The log shows the dial ended, not that someone answered.

## Still unverified
Plivo's real `dtmf` / `playedStream` / `clearAudio` events, `DialStatus` parameter name, end-to-end latency, native-speaker review of prompts.

## Voices and ears (optional keys)
- `CARTESIA_API_KEY` (server env): Telugu speech uses the same Cartesia voice as the Bolna Helpline (`CARTESIA_VOICE_ID`, `CARTESIA_MODEL` default `sonic-3.5`, `CARTESIA_VERSION` default `2025-04-16`). Any failure falls back to OpenAI speech. Request shape written from memory and **unverified against Cartesia's API**.
- `SARVAM_API_KEY` goes on the **Vercel app** (it serves `/api/saathi/stt`). When OpenAI hears Telugu, Sarvam `saaras:v3` also transcribes and its text is preferred; any failure falls back to OpenAI. `INTERPRETER_SARVAM=off` disables it.
- Arabic and other languages always use OpenAI for hearing and speaking.
