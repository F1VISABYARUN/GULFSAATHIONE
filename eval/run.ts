// Benchmark runner.
//   npm run eval                 -> real audio clips (needs eval/audio/* + OPENAI_API_KEY, or cached transcripts)
//   npm run eval -- --reference  -> sanity check on the human reference transcripts (no audio, no STT).
//                                   This measures the extractor on clean text — NOT a base-vs-harness result.
//   npm run eval -- --split test -> only held-out test clips

import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadDataset, getTranscripts, evaluateClip, promiseFor, EVAL_DIR } from './evaluate.ts';

const args = process.argv.slice(2);
const mode = args.includes('--reference') ? 'reference' : 'audio';
const split = args.includes('--split') ? args[args.indexOf('--split') + 1] : undefined;

const clips = loadDataset().filter(c => !split || c.split === split);
const results: Awaited<ReturnType<typeof evaluateClip>>[] = [];
const skipped: string[] = [];
for (const clip of clips) {
  const tx = await getTranscripts(clip, mode);
  if (!tx) { skipped.push(clip.id); continue; }
  results.push(await evaluateClip(clip, tx, promiseFor(clip, loadDataset())));
}

const names = [...new Set(results.flatMap(r => r.variants.map(v => v.name)))];
const summary = names.map(name => {
  const vs = results.map(r => r.variants.find(v => v.name === name)!).filter(Boolean);
  const expRisks = vs.reduce((a, v) => a + v.caught.length + v.missed.length, 0);
  return {
    variant: name,
    clips: vs.length,
    criticalTermAcc: avg(vs.map(v => v.termAcc)),
    meaningErrors: vs.reduce((a, v) => a + v.slotErrors.length, 0),
    risksCaught: `${vs.reduce((a, v) => a + v.caught.length, 0)}/${expRisks}`,
    riskRecall: expRisks ? vs.reduce((a, v) => a + v.caught.length, 0) / expRisks : 1,
    falseAlarms: vs.reduce((a, v) => a + v.falseAlarms.length, 0),
    wer: avg(vs.map(v => v.wer)),
  };
});

const out = { generatedAt: new Date().toISOString(), mode, split: split ?? 'all', skipped, summary, results };
writeFileSync(join(EVAL_DIR, mode === 'reference' ? 'results.reference.json' : 'results.json'), JSON.stringify(out, null, 2));

console.log(`\nMode: ${mode}${mode === 'reference' ? '  (clean reference text — extractor sanity check, not a benchmark)' : ''}`);
console.log(`Clips scored: ${results.length}  skipped (no audio/transcript): ${skipped.length ? skipped.join(', ') : 'none'}\n`);
console.table(summary.map(s => ({ ...s, criticalTermAcc: pct(s.criticalTermAcc), riskRecall: pct(s.riskRecall), wer: pct(s.wer) })));
for (const r of results) {
  const h = r.variants.find(v => v.name === 'harness')!;
  if (h.slotErrors.length || h.missed.length || h.falseAlarms.length) {
    console.log(`\n[${r.id}] harness issues:`);
    for (const e of h.slotErrors) console.log(`  slot ${e.slot}: expected ${JSON.stringify(e.expected)} got ${JSON.stringify(e.got)}`);
    if (h.missed.length) console.log(`  missed risks: ${h.missed.join(', ')}`);
    if (h.falseAlarms.length) console.log(`  false alarms: ${h.falseAlarms.join(', ')}`);
  }
}

function avg(xs: number[]) { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; }
function pct(x: number) { return `${(x * 100).toFixed(1)}%`; }
