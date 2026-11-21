# Gulf Saathi: call harness

Gulf Saathi is a risk intelligence layer for Telugu workers going to the Gulf. This repo is **the harness**: the layer around OpenAI speech-to-text that gets the exact words right. It handles:
- Telugu–English mix
- village and agent names
- "oka laksha yaabhai velu"
- Indian-cadence phone numbers
- Gulf terms (kafeel, iqama, huroob, AED/SAR)

Getting those right means the risk checks run on the truth instead of a broken transcript.

See `docs/HARNESS_EXPLAINED.md` (how it works, how it is evaluated) and `docs/GOAT_LIFE_PROBLEM_MAP.md` (the problem).

## Layers

| Layer | What | Where |
|---|---|---|
| L0 context | Caller's known names, places and terms → STT hint prompt + matching targets | `server/stt/openai.ts` `contextPrompt`, `server/harness/phonetic.ts` |
| L2 lock | Money (Telugu/Hindi/English → ₹/AED/SAR), phones (double/triple, +91 / Gulf), hours, Gulf terms, sound-based name/place repair | `server/harness/numbers.ts`, `terms.ts`, `phonetic.ts` |
| L3 meaning | Self-correction ("kadu kadu"), negation (*ichhadu* vs *ivvaledu*), distress words | `server/harness/terms.ts`, `extract.ts` |
| L4 gate | Read-back for unsure critical terms, escalate distress/huroob to a human | `server/harness/index.ts` |
| L5 translate | English translation with critical terms locked as placeholders | `server/stt/openai.ts` `safeTranslate` |
| Risk engine | Visit visa, fee above cap, flagged/unlicensed agent, passport held, salary unpaid/mismatch, job/hours mismatch, pickup mismatch, huroob, distress | `server/risk/engine.ts` |

The risk engine is **the same code** for base and harness. Any difference in risks caught comes from what was heard.

## Run

```bash
npm install
cp .env.example .env        # add OPENAI_API_KEY
npm test                    # unit tests for every layer
npm start                   # http://localhost:3000
```

Without a key the app runs in text mode: paste what the base model heard and see what the harness does.

## Benchmark

1. Put your call scripts in `eval/dataset.json`, replacing the template clips. For each clip fill in:
   - `reference`: exactly what was spoken
   - `context`: names and places known before the call
   - `expected`: critical terms, facts and risks
2. Record each clip as `eval/audio/<id>.wav`, ideally over a real phone call. Keep `split: "test"` clips for the final run only, and don't tune on them.
3. Run it:
   ```bash
   npm run eval                  # base STT vs hinted STT + harness, with ablation
   npm run eval -- --split test  # held-out clips only
   ```

**Transcript caching.** STT results are cached in `eval/cache/`, so you can change harness code and re-score without paying for STT again. Delete the cache to re-transcribe.

**Variants scored:**

| Variant | What it is |
|---|---|
| `base` | Raw STT + Saathi extractor, exact lookups only |
| `base+llm` | Raw STT + GPT extraction. The fair, strong baseline |
| `+L0 context` | Hinted STT |
| `+L2 repair` | Hinted STT + repair layers |
| `harness` | Everything on |

**Metrics:**

| Metric | Meaning |
|---|---|
| Risks caught | Risks present that were flagged (recall) |
| Meaning errors | Expected facts that came out wrong or missing |
| Critical-term accuracy | Names, places, Gulf words and distress words heard exactly |
| False alarms | Risks flagged that weren't present |
| WER | Word error rate of the STT words |

`npm run eval -- --reference` scores the human reference text. That is only a sanity check of the extractor, **not** a base-vs-harness result.

## Real calls (Bolna logs) and the fact sheet

`eval/bolna/` holds 27 real Saathi test calls pulled from Bolna:
- caller turns as Bolna's STT (Sarvam `saaras:v3`, `language: hi`) heard them
- per-call notes on what broke, in `FINDINGS.md`

The harness reads **Telugu and Devanagari script**. Rule-based transliteration (`server/harness/translit.ts`) plus a Telugu-script lexicon (`server/harness/lexicon.te.ts`), no LLM.

To fill in the fact sheet on your laptop:

```bash
npm install
npm run audio:bolna     # downloads the recordings into eval/audio/bolna/ (not in git)
npm start               # then open http://localhost:3000/facts.html
```

**How to fill each call:**
1. Listen to the call.
2. Fix the pre-filled guesses.
3. Set fields you can't hear to "can't tell"; those aren't scored.
4. Press **Save — verified**.

**About the guesses.** `facts.json` starts with Claude's guesses, all marked `unverified`. They were read from the same base transcripts, so scoring against them is partly circular, and the scorer ignores them unless asked.

```bash
npm run eval:bolna                      # score only the calls you verified
npm run eval:bolna -- --include-guesses # preliminary: include unverified guesses
npm run eval:bolna -- --stt             # also re-transcribe the caller channel with Telugu hints (needs OPENAI_API_KEY + ffmpeg)
```

**Variants scored:**

| Variant | What it is |
|---|---|
| `bolna base` | Bolna's transcript + Saathi engine, no repair |
| `base + harness` | Same transcript + repair layers + a Q/A layer that reads short answers using the bot's question |
| `re-STT + harness` | Caller-only audio re-transcribed with context hints + harness |

Agent-licence risks aren't scored on real calls, because the agent list is sample data.

## Data notes (verify before the demo)

- `server/data/agents.sample.json` is **fictional sample data**. Replace it with the registered recruiting-agent list from emigrate.gov.in and an official flagged list.
- **Fee cap:** ₹30,000 + 18% GST, per MEA advisories (`server/data/rules.json`). Verify that this figure is current.
- **Place list:** mandal spellings in `server/harness/lexicon.ts` should be checked against official lists.
- **Model names:** OpenAI model names and parameters are env-configurable. Check the current docs.
