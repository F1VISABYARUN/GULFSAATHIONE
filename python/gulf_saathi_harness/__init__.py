"""Gulf Saathi harness — Python port (drop-in for a FastAPI app).

    from gulf_saathi_harness import normalize, safety_net

normalize(text, questions=None)  -> dict of locked facts (money, phones, visa, distress, ...)
safety_net(transcript)            -> flags that must open a case even if the voice LLM never called a tool

Word lists come from lexicon.json, exported from the TypeScript harness (npm run export:python).
"""
from .core import to_latin, tokenize, find_money, find_phones, normalize, safety_net, parse_bolna_transcript

__all__ = ["to_latin", "tokenize", "find_money", "find_phones", "normalize", "safety_net", "parse_bolna_transcript"]
