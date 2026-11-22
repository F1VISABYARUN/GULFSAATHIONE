# Shared-phone interpreter

Run this long-lived Node service behind an HTTPS proxy with WebSocket upgrade support. Use one process, or configure sticky routing between the answer callback and WebSocket upgrade. One-time media tickets live in process memory for one minute. The Express backend must already serve the new multi-provider STT endpoint and translation endpoint. This service does not change any Bolna agent.

Set the following in the host secret manager.

| Setting | Purpose |
| --- | --- |
| INTERPRETER_ORIGIN | Public HTTPS origin of this service |
| SAATHI_URL, SAATHI_SECRET | HTTPS origin and shared secret for the existing backend |
| OPENAI_API_KEY | Speech synthesis for disclosures, prompts and translations |
| PLIVO_AUTH_ID, PLIVO_AUTH_TOKEN | Plivo account for signature verification and operator transfer |
| INTERPRETER_HUMAN_NUMBER | Staffed, verified E.164 caseworker number |
| INTERPRETER_TARGET | Other language, one of ar (default), en, hi, ur, ml |
| INTERPRETER_STT_MODEL | Backend STT model (default gpt-4o-transcribe). Sarvam does not support Arabic. Set transcription and translation credentials on the backend. |
| PORT | Service listen port, default 8080 |

Run `npx tsx interpreter/server.ts`. For a dedicated Plivo application, use GET with `https://<interpreter-origin>/answer` as its answer URL. For an authenticated outbound call to a known worker, the **trusted calling service** may append `?case_id=GS-...` to that call's answer URL. The signed case binding accompanies every translation request and lets the backend detect the registered private safety phrase. Missing or unconsented bound cases withhold translation. Unbound inbound callers have the generic safety gate only. Keep case IDs and temporary WebSocket URLs out of access logs. Configure provider recording and retention separately.

The gateway authenticates the answer callback with the Plivo V3 GET signature and returns a one-use WSS URL. It requires inbound 8 kHz μ-law and Plivo DTMF events. After both participants hear the AI disclosure and agree, the Telugu speaker presses 1 and the second speaker presses 2. Then press 1 for Telugu or 2 for the other language **at the start of each turn**, speak and press # or pause for one second. The speaker hears their source transcript; the Telugu speaker also hears the Telugu back-translation. Press 3 after playback completes to relay or select 1/2 to replace a misheard turn. Press 0 to cancel capture or playback. During the opening, 0 declines the interpreter. The phone's keypad controls turn ownership, so a code-mixed word cannot silently switch speakers.

The service requests a Plivo transfer on danger or blocked legal speech. Plivo then fetches a signed GET at `/human` which returns Dial XML for the configured caseworker. A transfer API acceptance alone cannot establish that a human answered. The service stores no recordings or transcripts. It emits stage timings for ASR, relay, queued read-back and accepted transfer, with no text or caller identifier. Queuing time excludes network playback. Speech is sent to configured STT, translation and speech providers. This phone path captures one turn per speaker with a 24-second bound.

## Verification

`npx tsx --test tests/phone-interpreter.test.ts` exercises a real local WebSocket handshake, simulated Plivo events, provider requests and case-gated read-back. Rehearse on a dedicated test number with two consenting speakers and a test caseworker before enabling worker traffic. Verify checkpoint notifications, interruptions, both voices, a corrected amount, failure to hear an answer, and a human actually answering a transfer. Capture per-direction audible delay and bilingual listener judgments externally; automated tests do not establish either.
