# Bolna call logs (your earlier test calls)

Pulled from the connected Bolna account on 2026-11-21.
- Agents: "Gulf Saathi" (`81ab8c71…`) and "Saathi Check-in agent" (`4ec8d84e…`).
- Calls: 45 executions between 18 Oct and 3 Nov 2026. **28 connected**; the rest were busy, unanswered or stopped.
- Audio: `eval/audio/bolna/<execution_id>.mp3` (gitignored, 15 MB).
- **Base model in these calls:** Sarvam `saaras:v3`, streaming, `language: "hi"` (Hindi) on a Telugu agent, with keywords empty and no context. LLM: `gpt-6-luna`. TTS: Sarvam `bulbul:v3`.

`user_turns.md` holds the caller turns exactly as Bolna's STT produced them (the **base transcript**), plus notes on what went wrong. Phone numbers are left out of this folder.
