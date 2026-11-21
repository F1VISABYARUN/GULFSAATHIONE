# What your 27 real calls show (Bolna logs, 18 Oct – 3 Nov 2026)

Source: 27 connected calls with speech (16 "Gulf Saathi" + 11 "Check-in"), read call by call. The counts below come from **my manual reading of the transcripts**, not from an automated scorer, so treat them as approximate. Caller turns and per-call notes are in `user_turns.md`.

**Setup that produced these transcripts (the "base"):**
- Sarvam `saaras:v3` streaming, **`language: "hi"`**, no keywords, no context.
- 8 kHz stereo phone audio: **left channel = caller, right = bot**.

## Failure types, by how often they showed up

| # | Failure | Calls affected (approx.) | Example from your calls | Harness layer that fixes it |
|---|---|---|---|---|
| 1 | **Wrong script/language in transcript** (Devanagari, Gurmukhi, Kannada, Marathi for Telugu speech) | ~12 / 27 | "ऐं टी ऐं टी" for "enti enti"; "ਕੀ ਆ ਬੇਜਾ"; "मैं दुबई से बोलता हूँ" then the same line in Telugu | **Config + L0:** set the STT language to Telugu (`te-IN`) or auto, and add keyword hints |
| 2 | **Bot kept speaking Hindi after the caller asked for Telugu** | 5 / 11 check-in calls | "నాకు హిందీ రాదు" → bot continues in Hindi; "इस कॉल में मैं हिंदी में ही बात करूँगा" | Agent config (TTS/LLM language lock), not STT |
| 3 | **Distress or risk heard but not acted on** | ~8 | "నన్ను కిడ్నాప్ చేశారు" → "అర్థమైంది. మీరు ఒంటరి కాదు" (×4); beating, passport taken, no pay → "which city?" | **L4 gate in code**: these must trigger escalation deterministically |
| 4 | **Bot claimed actions it didn't take** ("we informed your family", "complaint prepared") | ~6 | 12e3c302, d5acc09e, 3d12bcdc, 59dc411a, 4eff712a, 2d3958cc | Product rule: only say what the backend confirms |
| 5 | **Meaning flip on a critical word** | ~7 | **కొడుతున్నాడు→కోరుతున్నాడు** (beating→wants); **visa→విజయ/విజయ్** (×4); రమ్మన్నాడు↔అమ్మమన్నాడు; "खतर" = danger or Qatar? | **L2 lexicon + L3 meaning guard** |
| 6 | **Names and places mangled** | ~7 | Agent "Chella Mallesham" heard 6 ways; Jagtial as జగిరి / జగితి / జగీత్యాలయ; arbab as "Arabat" | **L0 context + L2 phonetic match** |
| 7 | **Country unclear** | ~6 | "పోమని / ఓ మా కి" (Oman?), "కత కత" / "కాతారు" (Qatar?), "దువా కించుకున్నాను" (Dubai) | L2 Gulf place lexicon + read-back |
| 8 | **Wrong match in the agent lookup** | 3 | "Ramesh, Jagtial" matched to "RAMESH S, Chennai", and the caller said "అవును" | **District must match before "licensed" is said**. The read-back should state the district. |
| 9 | **Numbers and phones broken** | 4 | **"zero" heard as "జూలై"**, so a 9-digit family number was saved; 4 tries to get one phone number; "ఐ లెక్కలు" for 5 lakh | **L2 phone decoder** (10-digit check), money parser |
| 10 | **Turn-taking: bot talks over the caller** | 6 calls with ≥9 interruptions | "నేను చెప్పే వరకు వినండి" ("listen until I finish") | Endpointing / semantic VAD (later phase) |

## What this means for the hackathon build

1. **Your benchmark already exists.** 27 real calls, real audio, and a real production base transcript (Sarvam via Bolna). No need to record new clips for the base side.
2. **Biggest gap in my harness code: it only reads romanized Telugu.** Your transcripts are in **Telugu script**. Next step is a deterministic Telugu-script layer:
   - either **transliterate Telugu script to romanized** with a rule-based converter (Telugu Unicode is regular, so this is possible without an LLM)
   - or add Telugu-script entries to the lexicon: లక్ష / లక్షలు / వేలు, కొడుతున్నారు / కాపాడండి, రాలేదు / ఇవ్వలేదు, పాస్‌పోర్ట్ తీసుకున్నారు
3. **The fairest harness comparison:** re-transcribe the **left channel (caller only)** with Telugu language + context hints (the promise record your check-in agent already sends), then run the deterministic layers. Compare with Bolna's transcript of the same audio.
4. **Ground truth is the remaining work, and only you can do it.** For each call, listen once and write down the true critical facts: agent name, district, country, amounts, phone, visa type, passport, salary paid?, distress yes/no. You don't need full transcripts; facts are enough to score "meaning errors" and "risks caught".
5. **The L4 gate in code is the strongest demo.** Rows 3 and 4 aren't STT errors; the bot heard "kidnapped" and did nothing. A deterministic gate that **always escalates** on distress or pickup mismatch is what a code-level harness does that a prompt doesn't.

## Things to verify in your backend
- Was a real case or alert created when the bot said "registered" / "family informed"? The case number **GS-W9HWSY** was reused across all test calls (same phone number), and the bot said "case open 13 days".
- Template bug: one call greeted "**{worker_name}** గారు".
