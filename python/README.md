# gulf_saathi_harness (Python)

A drop-in harness for the Gulf Saathi FastAPI app. It uses the standard library only.

It locks the words that decide risk *before* fixed rules read them:
- Telugu/Hindi script
- Telugu money words
- phone digits ("జూలై" heard for 0)
- "visa" heard as "విజయ్"
- negation
- distress, near-miss distress words, the safety phrase
- short answers read with the bot's question

## Use

```python
from gulf_saathi_harness import normalize, safety_net

# 1) tool inputs: normalise what the caller said before the LLM's numbers are trusted
normalize("agent ki oka laksha yaabhai velu ichanu")       # {'fee_inr': 150000}

# 2) Bolna webhook: safety net on the whole transcript
r = safety_net(payload["transcript"], code_phrase=worker.danger_phrase)
if r["escalate"]:
    open_case(reasons=r["critical_reasons"] + r["high_reasons"])  # even if report_problem was never called
```

`safety_net` maps onto the existing REASONS codes:
- `wrong_pickup`, `threatened_or_distress` (→ threatened), `code_phrase`, `papers_problem`
- high: `passport_taken`, `unpaid`

## Keep the word lists in sync
`lexicon.json` is exported from the TypeScript harness:

```bash
npm run export:python
```

## Tests

```bash
python3 python/test_harness.py
```
