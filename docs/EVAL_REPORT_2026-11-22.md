# Benchmark run, 22 Nov 2026 (three audio packs)

Packs are scored separately. Nothing here is a single "Saathi accuracy". Transcripts and audio are not in git; digit values from the personal-data clips are withheld.

| Pack | What it is | Denominator | Caveat |
|---|---|---|---|
| A. FLEURS Telugu | read Wikipedia sentences, clean / 8 kHz phone / noisy phone | 60 sentences x 3 = 180 files | read speech, not worker calls |
| B. IndicVoices Telugu | 4 phone role-plays (01-04) + 6 commands/monologues | 10 clips | whole-file references, clip 01 reference looks one-sided; unofficial mirror, internal use only |
| C. Arabic place requests | Saudi-dataset voice queries | 3 clips | accents not verified as Gulf; CC BY-NC-SA, internal only |
| D. FLEURS parallel | same sentence read in te/ar/en/hi/ml/ur | 9 clips, 2 sentences | read speech, MSA Arabic not Gulf |

Models: gpt-4o-transcribe, gpt-4o-mini-transcribe, whisper-1 (language auto-detected because the API rejects `te`; it wrote Kannada script, so its rows are **not** a fair comparison). Clips over 3.5 MB were re-encoded to 16 kHz mono FLAC for the same reason for every model.

## Results (after the harness fixes below)


## A. FLEURS Telugu read speech — 60 distinct sentences, each at 3 conditions (read Wikipedia text, NOT worker calls)

| model                  | condition      | n  | WER   | CER   | WER after harness | numbers by value | ref words missed (script-insensitive): telugu / english-latin / digit tokens | invented facts (money/phone/id/gulf/place) |
|------------------------|----------------|----|-------|-------|-------------------|------------------|------------------------------------------------------------------------------|--------------------------------------------|
| gpt-4o-transcribe      | clean_16k      | 60 | 30.3% | 12.6% | 30.3%             | 25/34            | 18.3% / 71.4% / 51.0%                                                        | 0                                          |
| gpt-4o-transcribe      | phone_8k       | 60 | 32.7% | 13.5% | 32.7%             | 27/34            | 20.5% / 73.5% / 49.0%                                                        | 0                                          |
| gpt-4o-transcribe      | phone_8k_noisy | 60 | 48.8% | 32.7% | 48.8%             | 27/34            | 35.9% / 77.6% / 46.9%                                                        | 0                                          |
| gpt-4o-mini-transcribe | clean_16k      | 60 | 36.4% | 17.8% | 36.4%             | 17/34            | 21.0% / 83.7% / 100.0%                                                       | 0                                          |
| gpt-4o-mini-transcribe | phone_8k       | 60 | 37.7% | 18.7% | 37.7%             | 12/34            | 22.4% / 79.6% / 100.0%                                                       | 0                                          |
| gpt-4o-mini-transcribe | phone_8k_noisy | 60 | 52.1% | 34.9% | 52.1%             | 12/34            | 36.2% / 85.7% / 98.0%                                                        | 0                                          |
| whisper-1              | clean_16k      | 60 | 86.0% | 59.5% | 85.9%             | 19/34            | 71.7% / 91.8% / 40.8%                                                        | place:1                                    |
| whisper-1              | phone_8k       | 60 | 90.2% | 60.4% | 90.2%             | 16/34            | 75.0% / 91.8% / 38.8%                                                        | 0                                          |
| whisper-1              | phone_8k_noisy | 60 | 92.8% | 73.6% | 92.8%             | 14/34            | 84.9% / 89.8% / 34.7%                                                        | 0                                          |

## B. IndicVoices Telugu — 10 clips (whole-file reference, not time-aligned; 01 reference seems one-sided)

| clip                       | type     | s      | gpt-4o-transcribe WER | gpt-4o-mini-transcribe WER | whisper-1 WER |
|----------------------------|----------|--------|-----------------------|----------------------------|---------------|
| 01_conv_milk_order         | 8k phone | 141.06 | 87.6%                 | 57.9%                      | 96.7%         |
| 02_conv_teacher_call       | 8k phone | 140.88 | 96.9%                 | 71.9%                      | 100.0%        |
| 03_conv_restaurant         | 8k phone | 128.82 | 86.5%                 | 69.3%                      | 98.2%         |
| 04_conv_university         | 8k phone | 200.68 | 92.8%                 | 85.9%                      | 100.0%        |
| 05_complaint_missing_items | 44k      | 92.63  | 54.9%                 | 41.4%                      | 100.0%        |
| 06_umang_uan_digits        | 44k      | 22.8   | 80.8%                 | 34.6%                      | 88.5%         |
| 07_payment_phone_digits    | 44k      | 13.29  | 66.7%                 | 19.0%                      | 57.1%         |
| 08_payment_rupees_vpa      | 44k      | 19.18  | 54.2%                 | 45.8%                      | 100.0%        |
| 09_govt_schemes            | 44k      | 128.71 | 57.5%                 | 46.9%                      | 100.0%        |
| 10_numbers_large           | 44k      | 12.97  | 9.1%                  | 9.1%                       | 68.2%         |

Facts the harness finds in the human transcript vs in each ASR output (digit values withheld):

| clip                    | model                  | reference facts | found in ASR | ASR invented | note                                                                                                |
|-------------------------|------------------------|-----------------|--------------|--------------|-----------------------------------------------------------------------------------------------------|
| 06_umang_uan_digits     | gpt-4o-transcribe      | 1               | 1/1          | 0            |                                                                                                     |
| 06_umang_uan_digits     | gpt-4o-mini-transcribe | 1               | 1/1          | 0            |                                                                                                     |
| 06_umang_uan_digits     | whisper-1              | 1               | 1/1          | 0            |                                                                                                     |
| 07_payment_phone_digits | gpt-4o-transcribe      | 1               | 1/1          | 0            | reference has 11 spoken digits (dataset oddity); correct behaviour is a read-back, not a silent fix |
| 07_payment_phone_digits | gpt-4o-mini-transcribe | 1               | 1/1          | 0            | reference has 11 spoken digits (dataset oddity); correct behaviour is a read-back, not a silent fix |
| 07_payment_phone_digits | whisper-1              | 1               | 0/1          | 0            | reference has 11 spoken digits (dataset oddity); correct behaviour is a read-back, not a silent fix |
| 08_payment_rupees_vpa   | gpt-4o-transcribe      | 2               | 1/2          | 0            |                                                                                                     |
| 08_payment_rupees_vpa   | gpt-4o-mini-transcribe | 2               | 1/2          | 0            |                                                                                                     |
| 08_payment_rupees_vpa   | whisper-1              | 2               | 2/2          | 0            |                                                                                                     |
| 10_numbers_large        | gpt-4o-transcribe      | 0               | 0/0          | 0            |                                                                                                     |
| 10_numbers_large        | gpt-4o-mini-transcribe | 0               | 0/0          | 0            |                                                                                                     |
| 10_numbers_large        | whisper-1              | 0               | 0/0          | 0            |                                                                                                     |

## C. Arabic place requests — 3 clips (Saudi dataset; speakers not verified as Gulf)

| clip      | expected action | model                  | WER vs ref | landmark/key term heard | intent on ASR text | intent on reference |
|-----------|-----------------|------------------------|------------|-------------------------|--------------------|---------------------|
| dir_ar_01 | search          | gpt-4o-transcribe      | 16.7%      | yes                     | unknown            | unknown             |
| dir_ar_01 | search          | gpt-4o-mini-transcribe | 16.7%      | yes                     | unknown            | unknown             |
| dir_ar_01 | search          | whisper-1              | 16.7%      | yes                     | unknown            | unknown             |
| dir_ar_02 | ask_landmark    | gpt-4o-transcribe      | n/a        | yes                     | find_place         | unknown             |
| dir_ar_02 | ask_landmark    | gpt-4o-mini-transcribe | n/a        | yes                     | find_place         | unknown             |
| dir_ar_02 | ask_landmark    | whisper-1              | n/a        | NO                      | unknown            | unknown             |
| dir_ar_03 | ask_city        | gpt-4o-transcribe      | n/a        | NO                      | unknown            | unknown             |
| dir_ar_03 | ask_city        | gpt-4o-mini-transcribe | n/a        | NO                      | unknown            | unknown             |
| dir_ar_03 | ask_city        | whisper-1              | n/a        | NO                      | unknown            | unknown             |

## D. FLEURS parallel read sentences — 9 clips, only 2 distinct sentences (speech recognition only; translation is scored in translate.ts)

| clip       | lang | gpt-4o-transcribe WER / CER | gpt-4o-mini-transcribe WER / CER | whisper-1 WER / CER |
|------------|------|-----------------------------|----------------------------------|---------------------|
| 1543_ar_eg | ar   | 0.0% / 0.0%                 | 0.0% / 0.0%                      | 0.0% / 0.0%         |
| 1543_en_us | en   | 0.0% / 0.0%                 | 0.0% / 0.0%                      | 0.0% / 0.0%         |
| 1543_hi_in | hi   | 100.0% / 107.7%             | 7.7% / 1.9%                      | 46.2% / 15.4%       |
| 1543_ml_in | ml   | 22.2% / 4.2%                | 55.6% / 10.4%                    | 100.0% / 100.0%     |
| 1543_te_in | te   | 23.1% / 7.1%                | 30.8% / 10.7%                    | 76.9% / 33.3%       |
| 1543_ur_pk | ur   | 20.0% / 6.8%                | 100.0% / 100.0%                  | 33.3% / 13.6%       |
| 1640_ar_eg | ar   | 0.0% / 0.0%                 | 0.0% / 0.0%                      | 22.2% / 2.4%        |
| 1640_en_us | en   | 0.0% / 0.0%                 | 0.0% / 0.0%                      | 0.0% / 0.0%         |
| 1640_te_in | te   | 38.9% / 16.7%               | 22.2% / 10.2%                    | 83.3% / 19.4%       |

### Translation (te to/from ar, en, hi, ml, ur) on the 2 distinct parallel sentences
11 of 11 directions passed the safety layer. chrF versus the human text ranged 31 to 75; it is low where the reference is Modern Standard Arabic and our output is Gulf colloquial, so it is not a quality score. On the driving-safety sentence (te to ar, en to te) the negation ("you cannot drive") survived; a local Whisper-small baseline reported earlier lost it. 2 sentences is far too few to claim anything about translation quality; a bilingual reviewer is still needed.

## Mistakes found
**Speech recognition**
- gpt-4o-transcribe is clearly better than the mini model on Telugu here: 30.3% vs 36.4% WER clean, and it keeps numbers as digits. The mini model writes numbers as run-together Telugu words (e.g. one word for "two thousand ten"), which the harness cannot parse (a harness gap too).
- English/Latin words inside Telugu are the weakest class for every model (71-84% of reference English words not matched even script-insensitively).
- Phone-band audio costs little (clean 30.3% to 8 kHz 32.7%); noise costs a lot (48.8%).
- Real phone role-plays (01-04) are at 86-97% WER for gpt-4o-transcribe against a whole-file, possibly one-sided reference. Treat those numbers as unusable until the references are checked; they say nothing reliable about call quality.

**Harness (found by running it on the human transcripts, so these are not speech errors)**
| Failure | Clip | Fix |
|---|---|---|
| spoken "thousand" / year in words became money (₹1,000, ₹2,025) | te_017, te_054, IV 04, IV 09 | money needs a currency or a fee/salary/payment cue; years are never money |
| a list of numbers merged into one amount (₹12,27,51,320) | IV 10 | place-value segmentation of number runs |
| "normal", "manam" (we), "Aasara" (a scheme) repaired to Nirmal / Manama / Basar (10 hits in one clip) | IV 03, 04, 09 | fuzzy places need a locative cue next to them |
| "driving" filled the job slot with "driver" | te_018 | removed the mapping |
| 11 spoken digits produced no phone (dialect "emmidi" = 8, "eduki" = 7+ki) | IV 07 | digit variants and dative suffix |
| UPI digits typed as a phone; "at the rate" spelled many ways | IV 08 | spoken @ recognised in its spellings |
| two years separated by punctuation joined into one 8-digit number | te_001 | punctuation ends a digit run (except commas between single dictated digits) |
| digits with a glued Telugu suffix (1789న) not read as numbers | te_003 and others | tokenizer splits the suffix and keeps the original spacing |

After the fixes the harness leaves all 360 FLEURS ASR transcripts unchanged and adds no entity to the 60 FLEURS human transcripts except one legitimate "2 hours".

## How the benchmark itself was weak, and what changed
- "Numbers exact" compared strings, so a model that wrote words instead of digits scored 0. Now numbers are compared by value.
- "English words missed" counted Latin words written in Telugu letters as misses. Now compared script-insensitively.
- WER after the harness was worse than raw WER because the corrected text re-spaced the sentence. Fixed and tested.
- Added a reference-only audit (harness on human text), 34 hand-written probes from these failures, and 7 seeded invariants (npm run eval:robust / eval:fuzz); the probes fail on the previous harness and pass now.
- Still not measurable here: held-out silent-critical-miss on real worker speech, read-back delivery in real calls, translation quality with reviewers.


## Addendum: is the harness better than the base reading?
Not demonstrated on these packs. On the 12 transcripts of the digit/amount clips (06, 07, 08, 10) x 3 models the harness and the base reading (all repair layers off) both found 9 of 12 reference facts, invented 0, and raised 8 read-backs. On the 180 clean FLEURS transcripts neither found or invented anything. The packs contain almost no Gulf terms, people or places, so the layers that differ (term repair, caller context, self-correction) are not exercised. The earlier Bolna replay (3 verified turns, 6 facts) was 2 of 6 vs 3 of 6. All of this is too small to claim an advantage; a fair test needs worker speech with Gulf terms.

## Addendum: Arabic to Telugu translation
It is built (`/tools/translate`, both directions). `npm run eval:translate` runs 25 sentences (written by Claude, not a native speaker) through the live relay and checks invariants only: numbers, negation, key terms (passport, salary, visa, embassy), and that signing, confessing and police statements are withheld and distress words escalate. After I corrected 7 of my own checks that were too strict, all 25 held (negation 6/6, numbers 8/8, directions 4/4, terms 1/1, positive 1/1, withheld 3/3, distress escalates 2/2). That says the relay did not flip a negation or drop a number on these sentences. It says nothing about fluency. A bilingual reviewer must still read the outputs.
