---
name: saathi-eval
description: Run and extend the Gulf Saathi benchmark (speech-to-text, harness, translation) on the audio packs and find which layer made each mistake. Use when asked to benchmark, evaluate, re-evaluate, check errors, or add test clips for Saathi.
---

# Gulf Saathi evaluation

Goal: say what is wrong, in which layer, with the denominator, without flattering the system. Never combine datasets into one "accuracy" number.

## Layers (find the layer before fixing anything)
1. **Speech recogniser (STT)** — wrong words/digits in the transcript.
2. **Harness** — wrong facts extracted from a *correct* transcript (money, phone, ID, Gulf term, place, job).
3. **Translation** — meaning changed (negation, numbers, who did what).
4. **Tool / Bolna** — endpoint right but the agent never called it, or Bolna failed (`tool_call_logs`, `termination_reason`).

Decision procedure for one failing clip:
- Run the harness on the **human reference text** (`npx tsx eval/e2e/refs.ts`). Wrong output there = harness bug.
- Reference fine, STT text wrong = STT error. Compare models with `eval/e2e/asr.ts`.
- Facts fine, translated text wrong = translation (needs a bilingual reviewer; chrF is only a rough similarity).
- Call the tool directly with the same input; if it works, the agent/prompt/Bolna did not use it.

## Run it
```
EVAL_DATA=<dir with the unzipped packs> EVAL_CACHE=<private dir> SAATHI_SECRET=... 
npx tsx eval/e2e/asr.ts            # fetch transcripts (cached, resumable) via /api/saathi/stt
npx tsx eval/e2e/score.ts out/     # WER/CER, numbers by value, missed words by class, facts matched/missed/invented
npx tsx eval/e2e/refs.ts           # what the harness invents on human transcripts
npx tsx eval/e2e/translate.ts      # te<->ar/en/hi/ml/ur on the parallel sentences (chrF + safety-layer outcome)
npm run eval:robust                # hand-written probes from past failures
npm run eval:fuzz 2000             # seeded property checks
```
Audio, transcripts and the cache stay OUTSIDE git. Clips with digits (UAN, phone, UPI) are personal data: report counts and lengths, never the digits.

## Rules
- Report each pack separately with its denominator: FLEURS 60 sentences x 3 conditions; IndicVoices 10 clips (only 01-04 are phone role-plays); Arabic place requests 3; parallel 9 clips / 2 sentences.
- Read speech (FLEURS) is not worker-call evidence. Use it for regression and for finding harness bugs.
- A generated read-back means the code proposed a question; only a call trace proves the worker heard it.
- Probes written from a failure pin that failure; they are not held-out. Only fresh speakers give a held-out score.
- Compare numbers by value and words script-insensitively (a model may write digits, number words, or Telugu letters for an English word). Otherwise the metric measures formatting.
- `whisper-1` rejects `language=te`; with auto-detect it wrote Kannada script, so its rows are not a fair model comparison.
- Every harness fix ships with: a probe in `eval/robustness/cases.json` that failed before, a unit test, and the Python port kept in parity (`npx tsx scripts/parity.ts`).

## Improving the benchmark
- Add failures as probes (kind: false_positive / digit_typing / must_still_work) with a one-line `why` naming the clip.
- Add a property to `eval/robustness/fuzz.ts` when a failure is a *class* (years, digit strings, everyday words).
- Check a new property against the old code (git worktree) to prove it can fail.
- Next datasets worth collecting: Telugu phone speech with Gulf terms and unpaid-salary/passport turns from fresh speakers (held-out); Gulf-dialect Arabic with native review; digit dictation including UPI handles and IDs.
