// Robustness probes for the harness: false-positive injection, digit typing, and must-still-work checks.
// Compares the full harness with the same extractor and every repair layer off (the base reading).
// Run: npm run eval:robust        (exit code 1 when a probe fails)
// These are hand-written probes. The counts are probe counts, not accuracy on real speech.
import { readFileSync } from 'node:fs';
import { runHarness, ALL_ON, ALL_OFF } from '../../server/harness/index.ts';

interface Case { id: string; kind: string; text: string; must?: string[]; mustNot?: string[]; readback?: boolean; why: string }
const { cases } = JSON.parse(readFileSync(new URL('./cases.json', import.meta.url), 'utf8')) as { cases: Case[] };

/** Facts the harness produced, as comparable tags: money, fee:N, salary:N, phone, idnumber[:kind], gulf[:id]. */
export function tags(text: string, on: boolean): { tags: string[]; readbacks: number } {
  const h = runHarness(text, {}, on ? ALL_ON : ALL_OFF);
  const t = new Set<string>();
  for (const e of h.entities) {
    if (e.superseded) continue;
    if (e.type === 'money') t.add('money');
    if (e.type === 'place') t.add('place');
    if (e.type === 'phone') t.add('phone');
    if (e.type === 'idnumber') { t.add('idnumber'); t.add('idnumber:' + (e.value as { kind: string }).kind); }
    if (e.type === 'gulf') { t.add('gulf'); t.add('gulf:' + String(e.value)); }
  }
  if (h.slots.job) t.add('job');
  if (h.slots.feeINR !== undefined) { t.add('fee'); t.add('fee:' + h.slots.feeINR); }
  if (h.slots.salary) { t.add('salary'); t.add('salary:' + h.slots.salary.amount); }
  return { tags: [...t], readbacks: h.readBacks.length };
}

function judge(c: Case, on: boolean) {
  const r = tags(c.text, on);
  const missing = (c.must ?? []).filter(m => !r.tags.includes(m));
  const invented = (c.mustNot ?? []).filter(m => r.tags.includes(m));
  const readbackOk = c.readback === undefined ? true : (r.readbacks > 0) === c.readback;
  return { pass: !missing.length && !invented.length && readbackOk, missing, invented, readbackOk };
}

if (process.argv[1]?.endsWith('run.ts')) {
  const kinds = [...new Set(cases.map(c => c.kind))];
  let harnessFail = 0;
  for (const k of kinds) {
    const set = cases.filter(c => c.kind === k);
    const full = set.map(c => judge(c, true)), base = set.map(c => judge(c, false));
    console.log(`${k}: harness ${full.filter(r => r.pass).length}/${set.length} probes pass | base reading ${base.filter(r => r.pass).length}/${set.length}`);
    set.forEach((c, i) => { if (!full[i].pass) { harnessFail++; console.log(`   FAIL ${c.id}: missing [${full[i].missing}] invented [${full[i].invented}]${full[i].readbackOk ? '' : ' readback mismatch'}  (${c.why})`); } });
  }
  console.log(`\n${cases.length} hand-written probes; not an accuracy figure on real speech.`);
  process.exit(harnessFail ? 1 : 0);
}
