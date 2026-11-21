"""Minimal FastAPI example: where the harness plugs into the Gulf Saathi server.

Run:  uvicorn example_app:app --app-dir python --port 8000
Same endpoint names as the real app, so the change there is a few lines each.
"""
from fastapi import FastAPI
from pydantic import BaseModel

from gulf_saathi_harness import normalize, safety_net

FEE_CAP = 35400  # Rs 30,000 + 18% GST
app = FastAPI(title="Gulf Saathi harness example")


class Fee(BaseModel):
    payments: str = ""          # what the LLM filled, e.g. "10000; 25000"
    caller_said: str = ""       # NEW: the caller's own words, so we don't trust the LLM's arithmetic


@app.post("/check-fee")
def check_fee(b: Fee):
    llm_total = sum(float(x) for x in b.payments.replace(",", "").split(";") if x.strip().replace(".", "").isdigit())
    heard = normalize(b.caller_said).get("fee_inr") if b.caller_said else None
    total = heard or llm_total
    out = {"total": total, "over_cap": total > FEE_CAP, "over_by": max(0, total - FEE_CAP)}
    if heard and llm_total and abs(heard - llm_total) > 1:
        out["mismatch"] = {"llm": llm_total, "harness": heard}
        out["instruction"] = f"Confirm the amount with the caller: {int(heard):,} rupees, correct?"
    return out


class Problem(BaseModel):
    notes: str = ""
    caller_said: str = ""
    threatened: str = ""
    passport_with_worker: str = ""
    taken_by_stranger: str = ""


@app.post("/tools/report-problem")
def report_problem(b: Problem):
    f = normalize(b.caller_said)
    # the harness fills what the LLM missed; it never clears what the LLM set
    filled = {
        "threatened": b.threatened or ("yes" if f.get("distress") else ""),
        "passport_with_worker": b.passport_with_worker or ("no" if f.get("passport_held") else ""),
        "taken_by_stranger": b.taken_by_stranger or ("yes" if f.get("taken_by_stranger") else ""),
    }
    return {"fields": filled, "harness_facts": f}


@app.post("/webhooks/bolna")
def bolna_webhook(payload: dict):
    rd = (payload.get("context_details") or {}).get("recipient_data") or {}
    r = safety_net(payload.get("transcript") or "", code_phrase=rd.get("code_phrase"))
    # in the real app: if r["escalate"] -> open/raise the case with these REASONS codes
    return {"execution_id": payload.get("id"), **r}
