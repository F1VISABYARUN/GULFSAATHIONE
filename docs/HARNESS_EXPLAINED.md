# Gulf Saathi Harness — explained from zero

Written 21 Nov 2026, Builders '26, Track 2 (Voice AI for India).
Anything marked **[verify]** is something I am not fully sure about. Check it before putting it on a slide.

---

## 0. What we are building, in one line

> **A harness that makes AI hear Telugu–English Gulf calls correctly, so that a risk (scam agent, illegal fee, unpaid salary, someone in danger) is caught from the real words, not from a broken transcript.**

Gulf Saathi is the product. The **harness is the thing we build this weekend**, and the benchmark proves it.

Why this and not ACTN AI: the mentors are right. Once a call is heard correctly, "do the action" is easy (any agent can send a WhatsApp or fill a CRM), and Equal AI already does that. The hard, unsolved part is **hearing Indian calls correctly and knowing when you might be wrong**. That part is ours.

---

## 1. What is a "harness"? (no jargon)

The AI model (OpenAI / Sarvam / Google speech-to-text) is an **engine**. It is very good, but it was not built for:
- a Jagtial worker mixing Telugu and English
- village, mandal and agent names it has never seen
- "oka laksha yaabhai velu", or phone numbers said as "double nine…"
- Gulf words like kafeel, iqama, huroob
- a bad phone line from a labour camp

A **harness is everything we build around the engine**, before and after it, so the final result is correct and safe. Think of a car: the model is the engine, and the harness is the steering, brakes, GPS and seatbelt.

**Important:** a harness is **not fine-tuning**.
- **Fine-tuning** changes the model's weights. It needs thousands of hours of labelled audio, GPUs and weeks of time. That is not possible in 26 hours.
- **A harness** leaves the model alone and controls:
  - **what goes in** (context, hints)
  - **how many models** we ask
  - **how we check** what comes out
  - **what we do when unsure**

It works on day one, and every company can use it on top of any model. Fine-tuning can come later, using the data the harness collects (Phase 9 below).

---

## 2. Why AI mishears: the actual failure types

These are the error types we expect. Phase 0 is about **measuring which ones actually happen** on our recordings instead of guessing.

| # | Failure | Example | Why it is dangerous |
|---|---|---|---|
| 1 | **Names and places** | "Kodimial" → "Cody meal", "Sircilla" → "Sir Cilla" | Case goes to the wrong agent or place |
| 2 | **Money** | "oka laksha yaabhai velu" → "oka laksha yabai" (number lost) | Illegal fee not detected |
| 3 | **Phone numbers** | "double nine eight…" → "99 8…" / missing digits | Can't reach agent or family |
| 4 | **Gulf Arabic terms** | "huroob" → "who rub", "iqama" → "a comma" | Absconding case missed |
| 5 | **Negation flip** (Telugu suffix) | "jeetham **ichhadu**" (he paid) vs "jeetham **ivvaledu**" (he didn't pay) | The meaning is reversed. Worst type. |
| 6 | **Self-correction** | "Tuesday… kadu kadu, Friday" | The wrong value gets saved |
| 7 | **Distress words** | "kodutunnaru" (they are beating me) misheard or dropped | A life-or-death signal is missed |
| 8 | **Translation drift** | Telugu → English translation softens "they took my passport" to "passport is with them" | The risk disappears in translation |

Your examples ("someone is going to kill me" heard as "kiss me", or "please help me" heard as "give me food") are types 7 and 8. A transcript can have a **low word error rate and still flip the meaning.** That is the core insight, and research backs it up: WER treats every word as equal, so a system can have low WER while getting names and critical words wrong (see sources: ContextASR-Bench, KeyASRBench, "Beyond WER" papers).

---

## 3. The harness architecture (6 layers)

```
 Call audio
    │
 L0 CONTEXT ──── who is this? past calls, promised salary, agent name, village
    │             (Equal AI's idea: the 11th call should be heard better than the 1st)
    ▼
 L1 HEAR TWICE ── STT model A (with context hints) + STT model B
    │             disagreement + token confidence = "where we might be wrong"
    ▼
 L2 LOCK CRITICAL TERMS (deterministic code, not LLM guessing)
    │   money parser (Telugu/Hindi/English → ₹ / AED / SAR)
    │   phone decoder (double/triple, 10-digit check, Gulf numbers)
    │   name/place matcher (phonetic, against gazetteer + this caller's context)
    │   Gulf glossary (kafeel, iqama, huroob, visit visa, final exit…)
    ▼
 L3 MEANING GUARD
    │   negation detector (ichhadu vs ivvaledu)
    │   self-correction resolver (kadu kadu → keep last value)
    │   distress detector (kodutunnaru, champestharu, kapadandi, annam pettatledu, passport teeskunnaru)
    ▼
 L4 CONFIDENCE GATE
    │   sure → proceed
    │   unsure on a critical term → READ-BACK ("meeru 1,50,000 ichharu, correct-aa?")
    │   distress or very unsure → HUMAN ESCALATION, never auto-dismiss
    ▼
 L5 SAFE TRANSLATION
    │   lock critical terms as placeholders before translating, restore after
    │   back-translate to check meaning didn't change
    ▼
 Gulf Saathi risk engine → risk flags in Telugu → ready case file
```

How each layer works:

- **L0 Context.** This is your Zomato example and Equal AI's flywheel. The first call stores facts: agent "Raju", village "Kodimial", promised salary "1500 AED". On the next call those words are passed to the STT model as hints, so it expects them. OpenAI's newer `gpt-transcribe` explicitly supports "unstructured context, keyword hints and multiple language hints" for domain terms and code-switching **[verify current API fields]**. Deepgram ("keyterm prompting") and AssemblyAI have similar features, so this is a standard technique. We apply it per caller, with memory.
- **L1 Hear twice.** Run two models (for example OpenAI and Sarvam Saaras v3, which has a "codemix" mode). Wherever they disagree on a critical word, we know to double-check. `gpt-4o-transcribe` can also return per-token confidence (`logprobs`). Low confidence on a number means "don't trust it yet".
- **L2 Lock.** Numbers, phone digits and dates are handled by **plain code we write**, not by the LLM. Code is instant, testable, and never hallucinates. Telugu is written in aksharalu and gunintalu, a sound-based script, so names can be compared **by sound** rather than spelling. That is how "Kodimyal", "Kodimial" and "Cody meal" all match Kodimial.
- **L3 Meaning.** Small rule sets, plus an LLM check, for the things that flip meaning: negation, corrections and distress words.
- **L4 Gate.** This is also the **trust answer** to the mentors. Humans build trust by repeating back what matters ("so 1.5 lakh, right?"). An agent that confirms only the critical terms, only when unsure, sounds careful rather than robotic, and it doesn't act on wrong information.
- **L5 Translate safely.** Protect the locked words so translation can't change them, then check by translating back.

---

## 4. Evals and benchmarks: how you prove it works

An **eval** is a test exam for the AI. A **benchmark** is a fixed exam everyone runs so results can be compared.

**Our exam (the dataset):**
- 20–30 real audio clips of Gulf-type calls: agent promise calls, worker check-ins, a few distress scenarios (acted).
- For each clip, a human writes:
  1. the exact **reference transcript**
  2. the list of **critical terms** (names, amounts, phones, Gulf words)
  3. the **true meaning** (fee paid = ₹1,50,000; salary paid = NO)
  4. the **risks that should be flagged**

**The test:** the same audio goes into (a) the **base model alone** and (b) **base model + harness**. Both outputs then go through **the same** Gulf Saathi risk engine. That keeps it fair, so nobody can say we used a weak baseline.

**Scoreboard (in order of importance):**

| Metric | Meaning | Why |
|---|---|---|
| **Risk recall** | Of the risks really present, how many were caught | The product outcome |
| **Meaning-changed errors** | Errors that change the facts (negation flip, wrong amount, missed distress) | What actually hurts people |
| **Critical term accuracy** | % of names/amounts/phones/Gulf words exactly right | Research calls this entity error rate / keyword recall |
| **False alarms** | Risks flagged that weren't real | A system that cries wolf gets ignored |
| **Read-back rate** | How often the harness asks to confirm | Too often is annoying, too rare is unsafe |
| **WER** | Word error rate | Shown, but secondary. AI4Bharat notes that WER overstates errors for Indic languages because of spelling variation |

**Ablation (shows engineering depth):** turn layers on one by one (base → +context → +lock → +meaning guard → +gate) and show how much each layer adds. Judges see that each layer earns its place.

**Honesty rules (these protect you on stage):**
- **Dev clips vs test clips.** Build and tune on dev clips. Record the test clips separately (different speakers if possible) and **don't tune on them**. Otherwise you are cheating on your own exam.
- **Say the sample size:** "24 clips, 6 speakers". Small honest numbers beat big vague ones.
- **Record on a real phone call** where possible. Phone audio is worse than a laptop mic, and that is where models break.

---

## 5. Natural, human-like conversation: where it fits

The mentors raised trust: people hang up on robotic or spam-like calls. Data supports the trust problem:
- A 2026 Truecaller and Tata Tele Business Services report says **79% of Indians avoid unknown business calls** **[verify figure in the report itself]**.
- A McAfee survey found most people can't tell AI voices from real ones **[older survey]**.

Natural conversation has three parts:
1. **Hearing correctly**: our harness.
2. **Turn-taking**: not cutting people off when they pause ("umm… ante…"). OpenAI's Realtime API already has a `semantic_vad` mode that estimates whether the speaker has finished.
3. **Voice quality**: TTS, which others (OpenAI, ElevenLabs, Sarvam) are already working on.

**My recommendation:** don't try to build all three. Own #1, use existing tools for #2 and #3, and **tell the trust story through the read-back**: "It doesn't sound robotic because it confirms only what matters, like a careful human would."

---

## 6. Phases

Assumes it's about Sat afternoon and code freeze is Sun 2 PM. Adjust if the clock says otherwise.

| Phase | When | What | Done when |
|---|---|---|---|
| **0. Failure discovery** | ~1.5 h | Write 10 call scripts, record them, run raw STT, **write down every actual error** by type (table in §2) | We know the real mistakes, not guesses |
| **1. Eval first** | ~2.5 h | Dataset format, scorer (all metrics), base-model run | **Baseline numbers exist** |
| **2. Lock layers** | ~4 h | L0 context hints, L2 money/phone/gazetteer/Gulf glossary + unit tests | Critical term accuracy goes up on dev clips |
| **3. Meaning + gate** | ~3 h | L3 negation/correction/distress, L4 read-back/escalate, risk engine, case file | Risk recall goes up and meaning errors go down |
| **4. Product + demo** | night | Side-by-side UI (red/green), Telugu risk flags, scoreboard, ablation table, live mic, deploy on AWS | Works end to end on a URL |
| **5. Held-out test** | Sun morning | Record fresh test clips, run the final benchmark, office hours with the Equal AI tech team | Final numbers you didn't tune on |
| **6. Ship** | Sun 11:30–1:30 | Backup video, 5 slides, rehearse, freeze at 1:30 | Submitted |

**Later (the "what's next" slide):**
7. Streaming, real-time calls
8. Full Gulf Arabic employer calls
9. Fine-tune on consented, harness-labelled call data
10. Integrations with MADAD, eMigrate and the state NRI cell

---

## 7. Facts checked

- **Fee cap.** MEA advisories say a recruiting agent can't collect more than **₹30,000 + 18% GST** from an emigrant, and must give a receipt. I didn't find a 2026 source confirming it is unchanged **[verify on emigrate.gov.in]**.
- **OpenAI models.**
  - `gpt-transcribe` (launched mid-2026) is recommended for new file transcription.
  - `gpt-4o-transcribe` supports `logprobs`.
  - Whether `prompt` and context fields work on each model **[verify in the API reference at the venue]**.
- **Sarvam.** Saarika v2.5 is deprecated, and Saaras v3 is recommended (it has a codemix mode). Sarvam's Telugu code-switching claims are vendor marketing, not independent benchmarks.

## Sources
- OpenAI transcription API reference: https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions
- OpenAI GPT-Transcribe model page: https://developers.openai.com/api/docs/models/gpt-transcribe
- OpenAI Realtime VAD guide: https://developers.openai.com/api/docs/guides/realtime-vad
- Deepgram keyterm prompting: https://developers.deepgram.com/docs/keyterm
- AI4Bharat Vistaar: https://github.com/AI4Bharat/vistaar , https://arxiv.org/abs/2305.15386
- IndicVoices: https://aclanthology.org/2024.findings-acl.639.pdf
- ContextASR-Bench (entity WER): https://arxiv.org/pdf/2507.05727
- KeyASRBench (keyword preservation): https://arxiv.org/pdf/2611.10852
- Jannet et al., ASR errors vs NER (Interspeech 2015): https://doi.org/10.21437/Interspeech.2015-322
- Sarvam Saaras / Saarika docs: https://docs.sarvam.ai/api/getting-started/models/saaras.md
- MEA advisory on service charge: https://www.eoivilnius.gov.in/pdf/Advisory%20circular-19-12-23.pdf
- Truecaller / TTBS report coverage: https://www.businesstoday.in/technology/news/story/79-of-indians-avoid-unknown-business-calls-creating-new-challenge-for-brands-report-541499-2026-07-08
