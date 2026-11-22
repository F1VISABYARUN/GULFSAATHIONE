# Deploying the phone interpreter

Untested on a real call. Vercel cannot hold WebSockets, so this runs on a container host (AWS or any other).

Build: `docker build -f Dockerfile.interpreter -t saathi-interpreter .`

Required env: `INTERPRETER_ORIGIN` (public HTTPS origin, no path), `SAATHI_URL` (the Vercel app), `SAATHI_SECRET`,
`PLIVO_AUTH_ID`, `PLIVO_AUTH_TOKEN`, `INTERPRETER_HUMAN_NUMBER` (E.164), `OPENAI_API_KEY`; optional `INTERPRETER_TARGET` (default `ar`).

AWS sketch (not run): ECS Fargate service behind an Application Load Balancer (supports WebSockets), CloudFront in front for HTTPS on a
`*.cloudfront.net` name. The Plivo signature is computed over `INTERPRETER_ORIGIN`, so it must equal the host Plivo calls.
A Workshop Studio account is temporary and may restrict services.

Plivo: point a number's answer URL (GET) at `<origin>/answer?case_id=GS-XXXX`. Keypad: 1 Telugu speaker, 2 other speaker, # end turn, 3 confirm, 0 stop.

## Behaviour
- A flagged amount or distress word is read back to its speaker first; key 3 releases that exact text for translation.
- The Telugu back-translation must keep negation and amounts (`meaningKept` in `server/relay.ts`) or the turn is refused.
- A case's private phrase never transfers the call: the desk is alerted silently via `/tools/record-checkin` and the turn sounds like an ordinary repeat request.
- A failed transfer alerts the desk and keeps the worker on the line. `/human-result` logs what Plivo reports (`DialStatus`, name unverified);
  anything but `completed` redirects the caller back to the interpreter. The log shows the dial ended, not that someone answered.

## Still unverified
Plivo's real `dtmf` / `playedStream` / `clearAudio` events, `DialStatus` parameter name, end-to-end latency, native-speaker review of prompts.
