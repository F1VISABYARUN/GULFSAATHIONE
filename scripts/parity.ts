// Parity check: the TypeScript and Python harnesses must agree on the 25 real Bolna calls.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { runHarness } from '../server/harness/index.ts';
import { withQuestionContext } from '../server/harness/qa.ts';

const calls = JSON.parse(readFileSync('eval/bolna/calls.json', 'utf8')).filter((c: any) => c.turns.length);
const py = JSON.parse(execFileSync('python3', ['-c', `
import json,sys; sys.path.insert(0,'python')
from gulf_saathi_harness import normalize
calls=json.load(open('eval/bolna/calls.json'))
print(json.dumps({c['id8']: normalize(turns=c['turns']) for c in calls if c['turns']}))`]).toString());

let bad = 0;
for (const c of calls) {
  const t = runHarness(withQuestionContext(c.turns)).slots;
  const p = py[c.id8];
  const pairs: [string, unknown, unknown][] = [
    ['fee', t.feeINR, p.fee_inr], ['visa', t.visaType, p.visa_type], ['passportHeld', t.passportHeld, p.passport_held],
    ['salaryPaid', t.salaryPaid, p.salary_paid], ['stranger', t.takenByStranger, p.taken_by_stranger],
    ['distress', !!t.distress?.length, !!p.distress?.length],
  ];
  for (const [k, a, b] of pairs) if ((a ?? null) !== (b ?? null)) { bad++; console.log(`${c.id8} ${k}: ts=${JSON.stringify(a)} py=${JSON.stringify(b)}`); }
}
console.log(bad ? `${bad} differences` : `parity ok on ${calls.length} real calls`);
process.exit(bad ? 1 : 0);
