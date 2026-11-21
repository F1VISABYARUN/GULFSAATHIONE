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
