# Harness robustness checks

Two cheap checks that run in seconds, with no audio and no network:

    npm run eval:robust      # 23 hand-written probes (false-positive injection, digit typing, must-still-work)
    npm run eval:fuzz 2000   # 7 seeded invariants over generated sentences

**What they are not:** accuracy on real speech. The probes were written from failures seen in real runs, so they pin
those failures down; they do not estimate how often new failures occur. Keep them separate from the Bolna replay,
the FLEURS runs and the IndicVoices pack, and never average them together.

What a pass means: the harness did not invent a fact (money, phone, Gulf term) that the sentence does not contain,
typed digit strings correctly, and still kept the facts it should (fee with a cue, salary with a currency,
real ASR variants of huroob/kafeel/iqama). Run against the pre-fix harness (`origin/main` at 6fd4519) the probes
scored 1/8 on false positives and 0/4 on digit typing, and the fuzz checks failed 5 of 7, so they do detect the bugs.

To find which layer is at fault for a real failure: feed the human reference text to the harness (harness bug if the
error remains), then the ASR text (speech-recognition error if only this fails), then call the tool directly (Bolna or
prompt problem if the endpoint is right but the call never used it).
