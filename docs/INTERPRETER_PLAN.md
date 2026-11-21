# Live interpreter plan, and what the last Bolna calls showed

## Last calls (Helpline agent, 21 Nov 2026, from a basic phone, no internet needed)
Call `bf1294bb` (197 s) and `f0f35848` (11 s). Mistakes read from the logs:

| # | Mistake | Evidence | Fix |
|---|---|---|---|
| 1 | About 9 s of silence at the start of both calls | time to first audio 8.8 s and 9.2 s; the 11 s call ended after the welcome line, the caller hung up | platform startup (stream setup ~6 s). Try a Bolna-bought number to compare; shorten the welcome line |
| 2 | The agent was cut off 15 times by the caller's noise or echo | `user_interrupted_agent_count` 15; agent turns end mid-word ("మీరు", "మీ సమస్యని") | `number_of_words_for_interruption` is 1 (was 3); set back to 3, raise interruption backoff. Not settable through the connector: change in the dashboard |
| 3 | Speech recogniser garbled place names and Telugu | "షేర్లింగం తల్లి" for Serilingampally; several non-words | keyword boosting with local place names; ask for a famous landmark; the harness/place search needs a spoken-name fallback |
| 4 | The agent promised to speak Arabic, then refused | "నేను అరబిక్‌లో చెప్పగలను" then "నేను మీ తరఫున ప్రత్యక్షంగా మాట్లాడలేను" | prompt fixed (applied to the live Helpline agent): it says it can only tell them what to say |
| 5 | A medicine dose was translated without a read-back | "డోలో 160" went straight into Arabic | prompt now requires reading back any dose, number or amount; the Arabic also contained an extra phrase ("كل نفس شي") the worker did not say |
| 6 | Place search used the area, not the caller | results were 1 to 2 km from the area centre | ask for a street or shop name; do not claim "nearest" |
| 7 | Two failed landmark attempts before the third worked | company-name landmarks were not found | accept area names, then ask for a nearby road |

## Concurrency (Bolna account facts read from `get_user_info`)
Concurrency limit is **2 calls at once** (tier "basic"). A third simultaneous call will not be answered by the agent. I do not know whether Bolna queues or rejects extra inbound calls: test with three phones and read the executions. Outbound calls placed through our scheduler are recorded as queued when over the limit. Raising the limit is a plan/account change with Bolna. Our backend on Vercel scales for parallel tool calls, but with the memory store each serverless instance has its own copy of the cases: connect Upstash Redis before real traffic.
Cost seen: 197 s call = 10.1 wallet units; wallet 674 units is roughly 220 minutes at that rate (units not verified as rupees).

## Live interpreter: what is wanted
Worker (Telugu) holds the phone near another person (Arabic, Hindi, Urdu, Malayalam...). The agent hears both, translates each side, and speaks the translation aloud in the other person's language, and in Telugu for the worker. Danger, signing/confession/police speech and dose/number mismatches stop it.

### Why Bolna alone cannot do it well
One phone leg carries both voices. Bolna agents run one speech recogniser and one voice per language at a time; the October agent's multi-language switching changes voice by turn but has no speaker separation, no echo control, and no translation-specific safety. Arabic speech recognition is not in the Sarvam model the agents use.

### Build
1. **Telephony:** Plivo Audio Streaming (WebSocket) from the number to our own server. Needs a server that keeps a WebSocket open, so not Vercel (use the Dockerfile on a container host).
2. **Hear:** streaming speech recognition with language detection per utterance. Candidates to benchmark first with `eval/e2e` (gpt-4o-transcribe did well on Arabic and Telugu read speech: Arabic 0% WER on 4 clips, Telugu 30% clean). `gpt-realtime-translate` is available on the server key; I have not used it, check its docs.
3. **Decide who spoke:** language of the utterance picks the direction (Telugu means worker, other means the other person). Add a "pause" word for the worker.
4. **Translate with checks:** reuse the relay (`server/relay.ts`): numbers and negation checked, legal speech withheld, distress escalates. For speed use the forward check only and run the back-translation in parallel.
5. **Speak:** text-to-speech in the target language (OpenAI `gpt-4o-mini-tts`, others) and Telugu for the worker (Sarvam).
6. **Echo:** the agent's own voice returns through the phone microphone: mute the recogniser while speaking and use speakerphone.
7. **Disclosure:** the agent says at the start, in both languages, that it is an AI translating. Check the law on recording others' speech in each country before launch.
8. **Latency target:** under about 3 seconds per turn, consecutive style (speak, then translation).

### Test (use `.claude/skills/saathi-eval`)
Per language: recogniser word error on real phone speech; critical facts kept (numbers, negation, who did what); end-to-end delay; then a bilingual reviewer on 100 real worker sentences. Fresh speakers for the held-out set. A first prototype can reuse `/tools/translate` with a human pressing "translate" before any voice-to-voice work.
