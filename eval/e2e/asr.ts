// Fetch transcripts for every clip and model (cached). Usage:
//   EVAL_DATA=/path/to/unzipped SAATHI_URL=https://... SAATHI_SECRET=... npx tsx eval/e2e/asr.ts [model ...]
import { loadItems, transcribe, MODELS, cached } from './lib.ts';
const root = process.env.EVAL_DATA!, base = process.env.SAATHI_URL ?? 'https://gulfsaathione.vercel.app', secret = process.env.SAATHI_SECRET!;
if (!root || !secret) { console.error('Set EVAL_DATA and SAATHI_SECRET'); process.exit(2); }
const models = process.argv.slice(2).length ? process.argv.slice(2) : MODELS;
const jobs = loadItems(root).flatMap(it => models.map(m => ({ it, m }))).filter(j => !cached(j.it, j.m));
console.log(`${jobs.length} transcriptions to fetch`);
let done = 0, failed = 0;
async function worker() { for (;;) { const j = jobs.pop(); if (!j) return; const r = await transcribe(j.it, j.m, base, secret); done++; if ('error' in r) { failed++; console.log(`FAIL ${j.m} ${j.it.id}: ${r.error}`); } if (done % 25 === 0) console.log(`${done} done, ${failed} failed`); } }
await Promise.all(Array.from({ length: Number(process.env.EVAL_CONCURRENCY ?? 5) }, worker));
console.log(`finished: ${done} attempted, ${failed} failed`);
