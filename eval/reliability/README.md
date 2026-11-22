# Critical facts on Gulf calls

Run from the repository root. Create a private worksheet outside Git. The default catalog is the 27 previously examined Bolna calls. Creation refuses to overwrite existing reviews.

    npm run benchmark -- init /tmp/saathi-review.json
    npm run benchmark -- /tmp/saathi-review.json text dev
    npm run benchmark -- /tmp/saathi-review.json trace heldout

For durable work, replace /tmp with a private persistent directory. The worksheet points to recordings relative to eval/. The init summary reports local recording availability. Pending and skipped turns never enter the denominator. With zero verified turns the report returns null scores. Use npm run --silent benchmark to redirect plain JSON to a private report.

## Label before looking at predictions

Listen to consented audio including the preceding question. Each row identifies a call and its one-based caller turn. Use a stable pseudonym for the actual speaker across all calls. Set truth for each preselected critical field, including absent fields so invented facts are counted. Use state reported and the exact canonical value, unclear for unintelligible speech, absent for information never supplied. Mark verified only after listening. Preserve amounts, currency, negation and attribution. For text replay, use server/harness/types.ts CaseSlots keys (salary means one salary, not both promised and paid). For traces, separate promisedSalary and paidSalary. Optionally supply referenceText for normalized WER and risks for turn-local risk IDs (an empty array means explicitly no risk). Omit these when unreviewed.

Example of reviewed truth:

    {"feeINR":{"state":"reported","value":150000},"passportHeld":{"state":"unclear"}}

Use the previously examined calls for development. Collect new speakers for heldout, freeze labels and the field list before scoring, and keep dev and heldout together in one worksheet. The runner rejects split overlap by call or speaker. Supply a custom catalog as the last argument to init or to scoring when adding new calls. Its JSON array entries need id8, audio and turns (each with text and an optional preceding question q).

## What each mode measures

Text replays the same archived transcript through the baseline extractor and Saathi. Saathi also uses any archived preceding question. It reports exact field accuracy, unsupported values, optional turn-local risk recall and false alarms, and length-weighted normalized WER against a human transcript (raw text versus corrected text). This mode has no evidence that a clarification was spoken. Its silent-miss and clarification metrics are null.

Trace uses actual outputs from two systems processing the same audio. Attach base and saathi objects for every verified turn in the selected split. Capture their facts independently of the labels. Use missing fields for omitted outputs and state unknown only for an explicit uncertainty flag. Keep the logged speaker response and delivered questions. For example:

    {"facts":{"passportHeld":{"state":"unknown"}},"asked":[["passportHeld"]],"extraSeconds":3}

When scoring optional human risks or referenceText, supply risks or transcript in both outputs. Supply p only for an actual probability of a value being correct. Bin counts, mean predicted confidence and observed accuracy are reported together. Timing stays null unless measured for all included turns. Questions per call covers reviewed turns; fully label calls before interpreting it as whole-call cost.

Silent critical miss rate = reported facts wrong or missing with neither explicit uncertainty nor a field-specific question, divided by all reported critical facts. A clarification can avert a silent miss but does not earn accuracy credit. Read flaggedUnresolved, exact accuracy, unknown precision/recall, and unsupported inventions alongside it. The report includes per-field denominators and missed turn IDs. These are turn-level measures; successful caseworker delivery is evaluated separately.

## Replay the same audio through multiple models

Keep clips, labels, playback recordings and predictions in a private directory outside git. Cut each caller turn to a mono clip. Preserve the final utterance and store the preceding question separately. Freeze one manifest, including development and held-out data, before inspecting results. A stable speaker pseudonym must identify the same person across calls. Set speakerVerified to true only after confirming that grouping. Held-out scoring requires this flag. Record the SHA-256 digest of each exact input file. One manifest row looks like this:

    {"id":"c1-t3","call":"c1","speaker":"worker-a","speakerVerified":true,"dataset":"consented-calls","direction":"te-ar","split":"heldout","status":"verified","audio":"c1-t3.wav","sha256":"<64 hex characters>","question":"Is your passport with you?","truth":{"passportHeld":{"state":"reported","value":true}}}

Use a private server URL and its SAATHI_SECRET. This command uploads each verified clip in the chosen split to each chosen provider through the backend. Choose only providers permitted to process those calls. For Arabic use models supporting Arabic. Errors remain in the observation file and give the command a nonzero exit. The collector refuses to overwrite the output.

    STT_RUNS=2 npx tsx eval/reliability/replay-audio.ts clips.json trials.jsonl heldout gpt-4o-transcribe gemini-2.5-flash
    npx tsx eval/reliability/score-audio.ts clips.json trials.jsonl heldout gpt-4o-transcribe gemini-2.5-flash

The scorer also accepts privately captured local runs using JSONL rows with clip, model, one-based run and text or error. Optional ms measures provider transcription time. The first run supplies each model's primary score. Missing and failed first runs appear in coverage counts. Only clips with successful first runs from every named model enter the paired comparison. Repeat disagreement counts how often any successful rerun changed the exact transcript; individual retries never increase the independent clip count. Read each dataset and language direction separately. Time percentiles use nearest ranks and show the observed sample size.

### Review what a listener heard

Attach the actual target-language recording to a successful trial with a private `playback` file path relative to trials.jsonl. Collect consent from both speakers. Create an anonymized, shuffled packet for a bilingual reviewer:

    npx tsx eval/reliability/listener-review.ts init clips.json trials.jsonl new-review-dir
    npx tsx eval/reliability/listener-review.ts join clips.json trials.jsonl new-review-dir reviewed-trials.jsonl
    npx tsx eval/reliability/score-audio.ts clips.json reviewed-trials.jsonl heldout gpt-4o-transcribe gemini-2.5-flash

Give the reviewer only the reviewer subdirectory. They listen to the source and the spoken output, enter the canonical facts actually heard, the fields with audible clarification or warning, a reviewer pseudonym and verified status in worksheet.json. Omit unheard facts. Supply firstAudioDelayMs only when call timing measures the interval from the end of the source utterance to the first audible output. Keep the private key file and the original observation files unchanged for joining. Audible critical misses and output latency remain unmeasured without eligible evidence. The final-audio rates require reviewed output from every compared system for the same clip. An absent or unclear truth labeled as a definite value counts as unsupported on the labeled fields.

### Local caller-channel replay, 22 November 2026

Three previously reviewed Bolna family-test turns from three calls had six audio-labeled facts in the private worksheet. Both local models received the same caller (left) channel, Telugu language hint, Silero segmentation and archived preceding question for the enhanced extractor. Each clip was decoded twice using the local CPU transcriber. Scoring used the first decode for each model. The speaker labels in this development worksheet are call-local placeholders, so the number of distinct people is unverified.

| Local model | Independent turns | Base facts | Saathi facts | Clips whose transcript changed on repeat |
|---|---:|---:|---:|---:|
| Whisper small, quantized ONNX | 3 | 0/6 | 0/6 | 0/3 |
| Whisper large-v3-turbo, quantized ONNX | 3 | 0/6 | 0/6 | 0/3 |

Each model produced words on all three clips. The combination of caller-channel transcription and extraction recovered none of the six labeled values. These clips measure development replay of an amount/payment turn, passport custody/attribution and arrival/pickup. The earlier archived Bolna text evaluation used a different input. Playback, a held-out speaker population, and cloud model comparisons were unmeasured in this run.
