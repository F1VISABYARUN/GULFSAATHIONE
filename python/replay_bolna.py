"""Replay the safety net over the 27 real Bolna test calls (eval/bolna/calls.json).
Shows, per call, what the harness would have escalated or flagged.
Run: python3 python/replay_bolna.py  (writes eval/bolna/replay_python.md)"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from gulf_saathi_harness import safety_net  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
calls = json.loads((ROOT / 'eval/bolna/calls.json').read_text(encoding='utf-8'))
facts = json.loads((ROOT / 'eval/bolna/facts.json').read_text(encoding='utf-8'))['calls']

rows, esc = [], 0
for c in calls:
    if not c['turns']:
        continue
    transcript = '\n'.join((f"assistant: {t['q']}\n" if t.get('q') else '') + f"user: {t['text']}" for t in c['turns'])
    r = safety_net(transcript, code_phrase='అమ్మ బాగుందా' if c['agent'] == 'checkin' else None)
    esc += r['escalate']
    f = facts.get(c['id8'], {})
    rows.append(f"| {c['id8']} | {c['agent']} | {'**ESCALATE**' if r['escalate'] else '—'} | {', '.join(r['critical_reasons'] + r['high_reasons']) or '—'} | {', '.join(f.get('risks', [])) or '—'} ({f.get('status', '?')}) |")

out = ['# Python safety net replayed on 25 real Bolna calls', '',
       f'Escalated: **{esc}** calls. Expected risks come from the fact sheet; "unverified" means Claude\'s guess, not checked by listening.', '',
       '| Call | Agent | Safety net | Reasons | Expected risks (fact sheet) |', '|---|---|---|---|---|', *rows]
(ROOT / 'eval/bolna/replay_python.md').write_text('\n'.join(out) + '\n', encoding='utf-8')
print('\n'.join(out))
