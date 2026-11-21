// Score the real Bolna calls against your fact sheet.
//   npm run eval:bolna                     -> only calls you marked "verified"
//   npm run eval:bolna -- --include-guesses -> also Claude's unverified guesses (PRELIMINARY, partly circular)
//   npm run eval:bolna -- --stt            -> also re-transcribe the caller channel (needs OPENAI_API_KEY + ffmpeg)

import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadCalls, loadFacts, scoreCall, BOLNA_DIR } from './score.ts';

const args = process.argv.slice(2);
const includeGuesses = args.includes('--include-guesses');
const withStt = args.includes('--stt');

const facts = loadFacts();
const calls = loadCalls().filter(c => {
  const f = facts.calls[c.id8];
  return f && f.status !== 'skip' && (f.status === 'verified' || includeGuesses) && c.turns.length > 0;
});
const verifiedCount = calls.filter(c => facts.calls[c.id8].status === 'verified').length;

const results: Awaited<ReturnType<typeof scoreCall>>[] = [];
for (const c of calls) results.push(await scoreCall(c, facts.calls[c.id8], withStt));

const names = [...new Set(results.flatMap(r => r.variants.map(v => v.name)))];
const summary = names.map(name => {
  const vs = results.map(r => r.variants.find(v => v.name === name)).filter(Boolean) as (typeof results)[number]['variants'];
  const facts = vs.reduce((a, v) => a + v.factsTotal, 0);
  const errors = vs.reduce((a, v) => a + v.factErrors.length, 0);
  const caught = vs.reduce((a, v) => a + v.caught.length, 0);
  const expected = caught + vs.reduce((a, v) => a + v.missed.length, 0);
  return {
    variant: name, calls: vs.length,
    factsRight: `${facts - errors}/${facts}`, meaningErrors: errors,
    risksCaught: `${caught}/${expected}`, riskRecall: expected ? caught / expected : 1,
    falseAlarms: vs.reduce((a, v) => a + v.falseAlarms.length, 0),
    escalated: vs.filter(v => v.escalate).length, readBacks: vs.reduce((a, v) => a + v.readBacks, 0),
  };
});

const out = { generatedAt: new Date().toISOString(), includeGuesses, verifiedCalls: verifiedCount, summary, results };
writeFileSync(join(BOLNA_DIR, '..', 'results.bolna.json'), JSON.stringify(out, null, 2));

if (!calls.length) {
  console.log('No calls to score. Verify some calls in the fact sheet (npm start → /facts.html), or run with --include-guesses for a preliminary look.');
  process.exit(0);
}
console.log(`\nReal Bolna calls scored: ${calls.length} (${verifiedCount} verified by you${includeGuesses ? `, ${calls.length - verifiedCount} unverified Claude guesses — PRELIMINARY` : ''})\n`);
console.table(summary.map(s => ({ ...s, riskRecall: `${(s.riskRecall * 100).toFixed(0)}%` })));
for (const r of results) {
  const b = r.variants[0], h = r.variants[1];
  const diff = [...h.caught.filter(x => !b.caught.includes(x)).map(x => `+${x}`), ...b.caught.filter(x => !h.caught.includes(x)).map(x => `-${x}`)];
  if (diff.length || h.factErrors.length || h.missed.length) {
    console.log(`\n[${r.id8}] ${r.status}  harness vs base: ${diff.join(' ') || 'same risks'}`);
    for (const e of h.factErrors) console.log(`   fact ${e.slot}: expected ${JSON.stringify(e.expected)} got ${JSON.stringify(e.got)}`);
    if (h.missed.length) console.log(`   missed: ${h.missed.join(', ')}`);
    if (h.falseAlarms.length) console.log(`   false alarms: ${h.falseAlarms.join(', ')}`);
  }
}
