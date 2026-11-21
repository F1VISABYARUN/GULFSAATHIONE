# Telugu and Indian Code-Mixed Speech Recognition: Benchmarks, Error Rates, and Evaluation Beyond WER

Research date: 2026-11-21. All figures are quoted from the cited source. Figures from vendors about their own products, or about competitors on vendor-run tests, are marked **[VENDOR CLAIM]**. WER figures from different test sets cannot be compared with each other.

## 1. Datasets and benchmarks that include Telugu (sizes, licences, access)

### Takeaway
There is plenty of monolingual Telugu evaluation data (Kathbath, IndicVoices, FLEURS, Vistaar's collection, and the telephony benchmark Voice of India). Public Telugu-English **code-mixed** speech data is scarce: there is a ~2.3 h high-code-mixing subset carved out of IndicVoices, a 2.5 h podcast set, and a 900-utterance IEEE DataPort benchmark. I found no large, open Telugu-English code-switched ASR corpus.

### Cited Findings
- **IndicVoices (AI4Bharat, ACL Findings 2024)**:
  - Collection: 7,348 h of read (9%), extempore (74%) and conversational (17%) audio from 16,237 speakers in 145 districts and 22 languages. 1,639 h had been transcribed at publication. — [IndicVoices, ACL Anthology](https://aclanthology.org/2024.findings-acl.639.pdf); [arXiv 2403.01926](https://arxiv.org/html/2403.01926v1)
  - Telugu split in the paper (Table 6): train 102 h from 477 speakers; test 5 h from 107 speakers. — [arXiv 2403.01926](https://arxiv.org/html/2403.01926v1)
  - Telephony: part of the data was recorded on an **8 kHz telephony channel** to represent low-income IVR users. Two-party role-play conversations were recorded over 8 kHz through a telephone bridge. — [arXiv 2403.01926](https://arxiv.org/html/2403.01926v1)
  - Code-mixing was deliberate: translators were asked for colloquial, code-mixed prompts, and digital-payments prompts mix English banking terms with the regional language. — [arXiv 2403.01926](https://arxiv.org/html/2403.01926v1)
  - Licence: dataset **CC-BY-4.0 ("allowing commercial usage")**; tools MIT (Section 10). — [arXiv 2403.01926](https://arxiv.org/html/2403.01926v1)
- **IndicVoices-R** (TTS derivative): Telugu is 136.40 h in total (6.91 h read, 129.49 h extempore) from 681 speakers. — [arXiv 2409.05356](https://arxiv.org/pdf/2409.05356)
- **Kathbath (AI4Bharat, part of IndicSUPERB, AAAI 2023)**:
  - Corpus: 1,684 h of labelled read speech in 12 languages from 1,218 contributors. It has a clean test set and a "noisy/hard" test set.
  - Telugu size: the AI4Bharat GitHub lists about 154.9 h of clean Telugu data. A secondary table (IndicST card) gives 139.2 h, so the sources disagree.
  - Licence: the packaging is **CC0**; the underlying text comes from the IndicCorp web crawl; code and models are MIT.
  - Access: gated on Hugging Face (you agree to share contact information), or direct download from the links on GitHub.
  - Sources: [HF Kathbath card](https://huggingface.co/datasets/ai4bharat/Kathbath); [IndicSUPERB GitHub](https://github.com/AI4Bharat/IndicSUPERB); [arXiv 2208.11761](https://arxiv.org/pdf/2208.11761); [IndicST card](https://huggingface.co/datasets/krutrim-ai-labs/IndicST)
- **Vistaar (AI4Bharat, Interspeech 2023, arXiv 2305.15386)**:
  - 59 benchmarks across languages and domains.
  - Telugu test sets: Kathbath, Kathbath-Hard (added noise), FLEURS, IndicTTS and MUCS.
  - IndicWhisper's Telugu training data is 806 h in total: Shrutilipi 390, NPTEL 183, Kathbath 142, MUCS 40, IndicTTS 36, FLEURS 8, Google TTS 6 and IIIT-IndicSpeech 2 (Table 2). This is also the only per-language Shrutilipi size I found: **Shrutilipi Telugu ≈ 390 h**, which is All India Radio news audio.
  - Source: [Vistaar arXiv HTML](https://arxiv.org/html/2305.15386v2)
- **Svarah (AI4Bharat, Interspeech 2023)**: Indian-accented **English**. 9.6 h of transcribed audio from 117 speakers in 65 locations, covering read, extempore and "use-case" (entity-heavy) speech. The data and code are on GitHub and Hugging Face. — [arXiv 2305.15760](https://ar5iv.labs.arxiv.org/html/2305.15760); [GitHub](https://github.com/AI4Bharat/Svarah)
- **Voice of India (AI4Bharat with partners, Interspeech 2026, arXiv 2604.19151)**: the closest public match to the hackathon's setting.
  - Built from **unscripted telephonic conversations**: 15 languages, 139 regional clusters, 306,230 utterances, 536 h, 36,691 speakers.
  - Scored with lattice-based, orthography-informed WER.
  - The benchmark is **closed-source**: the results are public, but the data cannot be downloaded.
  - Source: [arXiv 2604.19151](https://arxiv.org/abs/2604.19151)
- **Telugu-English code-mixed sets (CoSTA, Shankar, Jyothi & Bhattacharyya, arXiv 2406.10993, Jun 2024)**:
  - The authors found **no existing Te-En speech-transcription-translation dataset**, so they built two evaluation sets:
    - IndicVoices high-code-mixing subset: **2.3 h, 587 utterances, 102 speakers, CMI 25.5%**.
    - Podcast set: **2.5 h, 624 utterances, CMI 32.14%**, which is conversational, multi-speaker and disfluent.
  - Source: [arXiv 2406.10993](https://arxiv.org/html/2406.10993)
- **IEEE DataPort "Dialect and domain centric Telugu-English code-switched speech"**: 900 spontaneous conversational utterances, balanced across three domains (textile, dairy, pharmacy) and three dialects. It is intended for testing ASR robustness. — [IEEE DataPort](https://ieee-dataport.org/open-access/dialect-and-domain-centric-telugu-english-code-switched-speech)
- A forum post mentions a 200 h, 400-speaker Telugu-English corpus that is only available on request from its author. I could not verify whether it is accessible. — [DeepLearning.ai forum](https://community.deeplearning.ai/t/request-for-telugu-english-code-switched-speech-corpus-asr-project/890896)
- An earlier code-switching ASR paper notes that **Telugu-English has the highest code-mixing index** of the language pairs it studied (Tamil, Telugu and Gujarati with English). — [arXiv 2006.05257](https://arxiv.org/pdf/2006.05257) (as summarised in search results; not opened directly)
- **FLEURS (Google)** includes Telugu (te_in). Whisper's paper evaluates on it (see Section 2). I did not retrieve the dataset card's licence or hours (see Gaps).

### Inferences
- For a credible public test of Telugu-English calls, the best combination is:
  - the IndicVoices Telugu test set (5 h, CC-BY-4.0, includes 8 kHz telephony and colloquial code-mixed prompts);
  - CoSTA's IndicVoices high-CMI subset recipe;
  - a small, team-recorded set of in-domain call audio (Gulf migration and recruitment vocabulary).
- Kathbath is read speech. It is useful as a "clean upper bound", not as a proxy for calls.

### Gaps
- I did not verify the Common Voice Telugu hours or licence (Common Voice is generally CC0, but this was not checked).
- I did not retrieve the FLEURS Telugu hours or licence from the dataset card (the page did not render).
- IndicVoices' total Telugu collected hours (as opposed to the transcribed train/test split) is not given in the paper text I read.
- I found no public Te-En code-switched telephony dataset.

## 2. Reported Telugu WER numbers by system

### Takeaway
- Off-the-shelf multilingual models perform very badly on Telugu:
  - **Whisper large-v2: 99.0% WER on FLEURS Telugu** (OpenAI's own paper).
  - **Whisper: 151.9% WER on the IndicVoices Telugu test** (AI4Bharat).
  - **GPT-4o Transcribe: 69.3% WER on Telugu telephone conversations** (Voice of India, 2026).
- India-specific models are far better: Sarvam ≈ 18–19%, Amazon 19.7%, Gemini 3 Pro 21.9% and IndicConformer 23.7% on the same telephony benchmark. Even these get about one word in five wrong.

### Cited Findings
**OpenAI Whisper paper (Radford et al., Dec 2022), Table 13 "WER (%) on Fleurs", Telugu column:**

| Model | WER (%) |
|---|---|
| tiny | 105.1 |
| base | 105.2 |
| small | 98.2 |
| medium | 82.8 |
| large | 100.6 |
| **large-v2** | **99.0** |

— [Whisper paper PDF](https://cdn.openai.com/papers/whisper.pdf)

- I read the column order from the PDF text: Swedish, Swahili, Tamil, **Telugu**, Tajik… For comparison, Tamil large-v2 is 17.5.
- The same paper names Telugu (TE), along with Hebrew, Chinese and Korean, as languages that do **worse than their training data predicts**. It attributes this to "linguistic distance" and to "our byte level BPE tokenizer being a poor match". Its training-data figure appears to list only about **4.3 h** of Telugu ASR data; this value comes from text extraction of the figure and should be checked visually.

**IndicVoices paper (ACL Findings 2024), Table 7, Telugu, IndicVoices test set:**

| System | WER (%) |
|---|---|
| Google USM | 40.3 |
| Azure | 53.3 |
| **Whisper** | **151.9** |
| Meta MMS | 62.4 |
| AI4Bharat IndicASR | 26.8 |

— [arXiv 2403.01926](https://arxiv.org/html/2403.01926v1)

- A WER above 100% means hallucinated or inserted words. The paper does not explain this value.

**Vistaar (Interspeech 2023), Table 4, Telugu WER:**

| Benchmark | Google STT | Azure STT | IndicWav2Vec | IndicWhisper |
|---|---|---|---|---|
| Kathbath | 34.3 | 22.8 | 26.9 | 25.0 |
| Kathbath-Hard | 35.9 | NA* | 31.2 | 27.8 |
| FLEURS | 40.1 | 32.3 | 30.4 | 25.4 |
| IndicTTS | 55.4 | 61.1 | 32.3 | 33.8 |
| MUCS | 46.4 | 16.1 | 30.4 | 32.1 |
| **Average** | **42.4** | **31.4** | **30.2** | **28.8** |

— [Vistaar arXiv](https://arxiv.org/html/2305.15386v2)

- *The Azure Kathbath-Hard cell was garbled in extraction; check it against the PDF.
- Across languages, IndicWhisper has the lowest WER on 39 of 59 benchmarks.

**Voice of India (arXiv 2604.19151, Interspeech 2026; telephone conversations; orthography-informed lattice WER), Telugu:**

| System | WER (%) |
|---|---|
| Sarvam Audio | 18.2 |
| Saarika 2.5 | 18.9 |
| Amazon Transcribe | 19.7 |
| Gemini 3 Pro | 21.9 |
| ElevenLabs Scribe v2 | 23.0 |
| IndicConformer | 23.7 |
| Gemini 3 Flash | 27.9 |
| Deepgram Nova 3 | 43.1 |
| OmniASR LLM 7B | 50.7 |
| OmniASR LLM 1B | 57.3 |
| **GPT-4o Transcribe** | **69.3** |
| **GPT-4o Mini Transcribe** | **81.2** |
| AssemblyAI Universal | 105 |

— [arXiv 2604.19151 HTML](https://arxiv.org/html/2604.19151)

- Caveats on this table:
  - The header row was missing in text extraction. Telugu was matched to the 14th of 15 language columns, which is consistent with the paper's statement that AssemblyAI exceeds 100% on Telugu. **Confirm against the PDF before quoting on a slide.**
  - Azure has no Telugu value.
  - Several authors are affiliated with Sarvam and AI4Bharat, so this is not a fully neutral party.
- Voice of India also found:
  - District-level WER for the same model ranges from about 4% to 44%.
  - WER rises as audio quality falls. From the best to the worst DNSMOS quartile: Gemini 3 Pro 13.42% → 23.44%; ElevenLabs Scribe 15.31% → 25.20%.
  - Utterances under 2 seconds are hardest. Amazon goes from 10.45% (over 5 s) to 18.74% (under 2 s). Very short replies such as "haan", "ledu" and digits are exactly what a voice agent receives.
  - — [arXiv 2604.19151 HTML](https://arxiv.org/html/2604.19151)

**Telugu-English code-mixed (CoSTA, IndicVoices high-CMI subset, Table 4), Te-En WER:**

| System | WER (%) |
|---|---|
| Whisper ST | 44.15 |
| IndicWav2Vec pipeline | 37.95 |
| Seamless | 38.23 |
| Seamless fine-tuned ASR+ST | 35.61 |
| CoSTA | 34.37 |

— [arXiv 2406.10993](https://arxiv.org/html/2406.10993)

- These sit inside a speech-translation study, so treat them as indicative of code-mixed ASR difficulty, not as a clean ASR leaderboard.

**Sarvam [VENDOR CLAIM]:**
- Saaras V3 (11 Feb 2026) reports ~19% WER on IndicVoices overall and 19.31% on the 10 most popular IndicVoices languages, compared with ~22% for Saaras V2.5.
- It claims a "consistent margin" over GPT-4o Transcribe, Gemini 3 Pro, Deepgram Nova3 and Scribe v2, but gives **no per-language (Telugu) figure and no competitor numbers**.
- It says competitors "either completely lack coverage or yield heavily degraded transcriptions" on the other 12 languages.
- — [Sarvam blog: Saaras V3](https://sarvam.ai/blogs/asr)
- Saarika v2.5's docs give an aggregate ~18.32% WER on Vistaar across 11 languages, with no Telugu breakdown. — [Sarvam docs](https://docs.sarvam.ai/api/getting-started/models/saarika.md) (via search snippet)

**Other vendor claims:**
- **[VENDOR CLAIM, competitor marketing]** ElevenLabs' Telugu page lists Whisper Large v3 at 68.1% WER on FLEURS Telugu. — [ElevenLabs](https://elevenlabs.io/speech-to-text/telugu)
- A BuzzASR model card reports Whisper-large-v3 zero-shot **CER 82.65** on FLEURS Telugu. — [HF BuzzASR/telugu](https://huggingface.co/BuzzASR/telugu)
- After fine-tuning, community Whisper large-v2 Telugu models reach 9.65 WER on FLEURS. This shows the problem is lack of training data, not something that cannot be fixed. — [HF vasista22/whisper-telugu-large-v2](https://huggingface.co/vasista22/whisper-telugu-large-v2)

### Inferences
- A citable one-liner: "OpenAI's own Whisper paper reports 99.0% WER for Whisper large-v2 on FLEURS Telugu (Table 13). AI4Bharat's IndicVoices paper measured Whisper at 151.9% WER on natural Telugu speech. On real Indian telephone conversations, GPT-4o Transcribe scored 69.3% WER on Telugu (Voice of India, Interspeech 2026), against about 18–24% for India-specific models."
- The hackathon claim should be "*general-purpose/global* base models break on Telugu calls", not that all models do. Indic-specialised models (Sarvam, IndicConformer, Gemini 3 Pro, AWS) are around 18–24% WER on telephone Telugu. That is usable, but still roughly one word in five, so entity-critical verification is still needed.
- None of these numbers is specifically Telugu-English **code-switched telephony**. The team's own small test set fills that gap.

### Gaps
- I found no public Telugu figure for "gpt-transcribe" (a newer OpenAI model, if one exists) beyond the GPT-4o Transcribe numbers above.
- I found no official Google Chirp or Azure Telugu figures from the vendors themselves. The only figures are from third-party AI4Bharat papers (USM 40.3, Azure 53.3 on IndicVoices; Google STT 42.4 and Azure 31.4 average on Vistaar).
- I found no IndicConformer per-language number from its model card. The Voice of India figure (23.7) is the only one gathered.
- Whisper large-v3 Telugu has no first-party OpenAI per-language figure; only vendor or community numbers exist.

## 3. Named-entity, numeral, and code-switching errors; telephony (8 kHz) degradation

### Takeaway
- Entity-heavy, everyday "use-case" utterances are the hardest category even for strong models.
- Code-mixed English loanwords written in Telugu script are counted as errors by standard WER.
- Telephony and low audio quality add a substantial penalty. The peer-reviewed telephony evidence is from Voice of India (audio quality and short utterances). The specific Telugu 8 kHz delta is only available from vendor blogs.

### Cited Findings
- **Svarah** (Indian-accented English), overall WER (Table 1):

| Model | WER (%) |
|---|---|
| Whisper large | 7.2 |
| Whisper medium | 8.3 |
| NVIDIA Conformer large | 14.6 |
| Azure (US) | 20.9 |
| Azure (IN) | 21.3 |
| Google (US) | 30.0 |
| Google (IN) | 20.7 |

  - On entity-heavy **use-case** prompts, Whisper large reaches **11.2**, compared with 6.2 on read and 7.4 on extempore speech. The authors write: "Recognizing such entities when spoken in Indian accents is hard for existing ASR systems."
  - — [arXiv 2305.15760](https://ar5iv.labs.arxiv.org/html/2305.15760)
- **Voice of India**:
  - Code-mixed speech contains English-origin words with non-standard native-script spellings, which strict WER penalises. Their lattice method treats multi-word phrases and named-entity spelling variants as valid alternatives.
  - Higher-income speakers had slightly higher WER, which the authors suggest may come from more code-mixing. They give no quantitative code-mixing breakdown.
  - — [arXiv 2604.19151](https://arxiv.org/html/2604.19151)
- **Sarvam's evaluation blog (2 Apr 2026)** [VENDOR, illustrative examples]:
  - Numerals: "पांच सौ", "500" and "५००" mean the same thing but WER treats them as different tokens.
  - Loanwords: "doctor" vs "डॉक्टर" counts as a substitution.
  - Entities: WER barely penalises a wrong account number or dosage, even though the task then fails.
  - — [Sarvam blog](https://www.sarvam.ai/blogs/evaluating-indian-language-asr)
- **Code-switching penalty (general)**: a survey cites 30–50% higher WER on code-switched data for monolingually trained ASR (attributed to Singh et al. 2025; I did not verify the original). — [arXiv 2510.07037](https://arxiv.org/html/2510.07037v3)
- Interspeech 2025 work on Hindi-English Whisper adaptation focuses on errors at code-switch points. — [Biswas et al., Interspeech 2025](https://www.isca-archive.org/interspeech_2025/biswas25_interspeech.pdf)
- **Telephony**:
  - IndicVoices includes 8 kHz telephone-bridge recordings. — [arXiv 2403.01926](https://arxiv.org/html/2403.01926v1)
  - An academic study, "Factors affecting ASR performance… in Indic Languages" (arXiv 2606.09335, Jun 2026; IISc, Prasanta Kumar Ghosh's group), covers Hindi, Bengali, Kannada, Marathi and **Telugu**. It analyses telephone codecs, resampling and noise. Per search summaries, wideband 3G–5G stays close to clean baselines, classical resampling beats neural restoration, and competing background speech causes the largest degradation. I did not read the Telugu-specific numbers. — [arXiv 2606.09335](https://arxiv.org/abs/2606.09335)
  - **[VENDOR CLAIM]** Caller.digital's 8 kHz benchmark (900 utterances, 45 speakers) reports Telugu WER of 6.1% on wideband vs **12.4% on G.711**, a +6.3-point drop. It says Tamil and Telugu degrade about 2.3 points more than Hindi because narrowband audio discards the high-frequency cues that distinguish retroflex from dental consonants. — [caller.digital 8 kHz benchmark](https://caller.digital/blog/8khz-narrowband-telephony-asr-tts-benchmark-india-2026)
  - **[VENDOR CLAIM]** Caller.digital also says models trained on studio data lose 8–14 WER points on telephony audio. — [caller.digital](https://caller.digital/blog/8khz-narrowband-telephony-asr-tts-benchmark-india-2026)
  - **[VENDOR CLAIM]** Gnani claims under 4% WER and first place in 8 of 9 languages on "Kathbath Noisy 8kHz". This is unverified. — [Gnani](https://www.gnani.ai/resources/research/the-rural-india-asr-problem-engineering-speech-recognition-for-background-noise)

### Inferences
- The entities that matter for Gulf Saathi (agent names, recruiting-agency names, Gulf city names, passport and phone numbers, amounts in rupees or dirhams/riyals, visa types) fall into the category the literature shows is hardest: entity-heavy, everyday, code-mixed speech over narrowband audio.
- These entities should be scored separately from WER.

### Gaps
- I found no peer-reviewed, Telugu-specific number for the drop from 16 kHz to 8 kHz. The vendor figure (+6.3 points) is the only Telugu-specific one.
- I found no published Telugu numeral or entity error-rate breakdown.

## 4. Evaluation best practice beyond WER (entity accuracy, keyword recall, Indic orthography)

### Takeaway
- Plain single-reference WER is unreliable for Telugu. Three things inflate it:
  - Telugu is agglutinative, so CER is preferred.
  - Spellings vary and code-mixed loanwords have no fixed native-script spelling.
  - Whisper-style text normalisers are flawed for Indic scripts.
- A credible harness should report:
  - CER and normalised or orthography-aware WER;
  - **entity error rate** (1 − entity recall), counting an entity as correct only if every word in it is right;
  - keyword or critical-term recall;
  - a task-level (intent) success metric.

### Cited Findings
- **AI4Bharat orthography argument (Voice of India)**:
  - Single-reference WER is replaced by **lattice-based, Orthographically-Informed WER (OIWER)**.
  - Valid spelling and segmentation variants are listed (e.g., "login" vs "log in") and pruned. Disfluencies are made optional. Disputed spans go to human review.
  - This produces **more stable system rankings** than single-reference WER.
  - — [arXiv 2604.19151](https://arxiv.org/html/2604.19151)
- **Normalisation pitfalls (Manohar, Pillai & Sherly, EMNLP 2024, arXiv 2409.02449)**:
  - The text normalisers used by Whisper, MMS, Seamless and AssemblyAI are "fundamentally flawed when applied to Indic scripts" and make Indic metrics look **artificially better**.
  - A related summary says Whisper's normaliser removes vowel signs (matras).
  - — [arXiv 2409.02449](https://arxiv.org/abs/2409.02449)
- **Sarvam's evaluation framework (2 Apr 2026)** [VENDOR]:
  - CER is preferred for Telugu, Kannada and Malayalam.
  - Proposed metrics and thresholds:

| Metric | Threshold |
|---|---|
| LLM-WER / LLM-CER (LLM judge accepts equivalent spellings) | under 15% |
| Intent Score (binary) | 100% pass |
| **Entity Preservation Score** | ≥0.90 in general; **≥0.95 for banking, medical and navigation** |

  - One inserted negation word ("I do **not** want…") costs only about 14% WER but reverses the meaning.
  - — [Sarvam blog](https://www.sarvam.ai/blogs/evaluating-indian-language-asr)
- **Entity metrics literature**:
  - NE-WER (Garofolo et al. 1999) restricts WER to words inside named entities.
  - ATENE (Ben Jannet et al., Interspeech 2015) estimates the probability that an ASR error causes a downstream named-entity error. It correlated better with NER performance than WER did. ETER (Interspeech 2017) is a follow-up.
  - — [Interspeech 2015](https://www.isca-archive.org/interspeech_2015/jannet15_interspeech.pdf); [Interspeech 2017](https://www.isca-archive.org/interspeech_2017/jannet17_interspeech.pdf)
  - **Entity Error Rate = 1 − entity recall**, where an entity counts only if all of its words are right. — [arXiv 2604.00610](https://arxiv.org/pdf/2604.00610)
  - "Why Aren't We NER Yet?" (ACL 2023) argues that F1 on ASR transcripts mixes NER-model errors with ASR errors. — [ACL 2023](https://aclanthology.org/2023.acl-long.98.pdf)
- **CoSE-E (EMNLP 2026 SALMA workshop, arXiv 2609.35645)**: a code-switched enterprise benchmark across 5 language pairs (not named in the abstract). It goes "beyond edit-distance errors" to measure how transcription errors **propagate to downstream voice-agent task failures**. — [arXiv 2609.35645](https://arxiv.org/abs/2609.35645)

### Inferences (recommended harness protocol)
1. **Test set**:
   - 50–200 call-like Telugu-English utterances, recorded or played over 8 kHz (G.711) as well as 16 kHz.
   - Seeded with the critical terms: recruiting-agent and agency names, Gulf cities, passport, visa and phone numbers, amounts, "ECR/ECNR" and similar terms.
   - Add the public IndicVoices Telugu test (CC-BY-4.0) as an external anchor.
2. **Metrics**:
   - CER;
   - WER after Indic-aware normalisation (do not use Whisper's normaliser), ideally with multiple accepted spellings in the style of OIWER;
   - **critical-term recall / entity error rate**, with exact match after numeral normalisation;
   - **digit-string accuracy** for numbers;
   - intent or task success (did the harness extract the right risk signal);
   - negation-flip rate.
3. **Comparison**:
   - The base model (e.g., Whisper or GPT-4o Transcribe) vs the harness (Indic ASR, plus a domain vocabulary, an LLM correction step and confirmation read-back).
   - Report bootstrap confidence intervals, because the test sets are small.
4. **Citing**: anchor claims to the first-party or peer-reviewed numbers in Section 2, and label vendor numbers as vendor claims.

### Gaps
- I found no standard, published Telugu entity-error-rate benchmark. Teams will have to define their own entity list.

## 5. Published evidence on Indian-language voice agents failing in production (turn-taking, language ID)

### Takeaway
There is little peer-reviewed work specifically on turn-taking or endpointing failures in Indian-language voice agents. The nearest evidence is about short utterances, code-switch points, and error propagation into agent tasks.

### Cited Findings
- **Short utterances**: utterances under 2 s are the hardest category in Voice of India. Amazon goes from 10.45% to 18.74% WER. This matters for agent turns made of single words like "avunu" or "ledu". — [arXiv 2604.19151](https://arxiv.org/html/2604.19151)
- **Error propagation**: CoSE-E explicitly measures how code-switched transcription errors propagate into **downstream voice-agent task failures** in enterprise settings. — [arXiv 2609.35645](https://arxiv.org/abs/2609.35645)
- **Language identification**: the Whisper paper evaluates language ID on FLEURS and notes that Whisper has no training data for 20 of FLEURS' 102 languages. Telugu is one of the languages that performs worse than its training data predicts. — [Whisper paper](https://cdn.openai.com/papers/whisper.pdf)
- The DISPLACE challenge (speaker and **language diarization** in Indian conversational, code-mixed audio) is a related benchmark. — [arXiv 2406.09494](https://arxiv.org/pdf/2406.09494)
- **[VENDOR, marketing]** Caller.digital publishes posts titled "India's Voice AI Accuracy Problem: Why Global Models Fail for Indian Languages", with Telugu WER for global models at around 25–28% vs 10.8% for an "India-first" model on telephony-style audio. These are self-interested, unaudited numbers. — [caller.digital](https://www.caller.digital/blog/india-voice-ai-accuracy-global-models-fail-indian-languages)

### Inferences
- The team can argue from first principles: wrong language detection makes Whisper-family models transcribe or translate into the wrong script, which shows up as WER above 100% in Section 2. Short single-word turns have the highest WER. Together these mean a base agent will mishear confirmations and entities.
- The team should present this as a reasoned risk backed by the cited numbers, not as a published production post-mortem.

### Gaps
- I found no peer-reviewed post-mortem of an Indian-language voice agent failing in production on turn-taking or endpointing.
- I found no Telugu-specific language-ID error rate for code-mixed telephony.
- I did not open the CoSE-E full text, so its language pairs (and whether any are Indian) and its numbers remain unverified.
