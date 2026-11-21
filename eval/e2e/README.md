# End-to-end benchmark runner

See `.claude/skills/saathi-eval/SKILL.md` for the procedure and rules. Files:

- `lib.ts` — pack loaders, WER/CER/chrF, cached STT client for `POST /api/saathi/stt` (model allowlist; long clips re-encoded to 16 kHz FLAC for the 4.5 MB body limit)
- `asr.ts` — fetch transcripts for every clip and model
- `score.ts` — per-pack tables; `refs.ts` — harness on human transcripts; `translate.ts` — parallel-sentence translation check

Data (audio, references, transcripts) is never committed.
