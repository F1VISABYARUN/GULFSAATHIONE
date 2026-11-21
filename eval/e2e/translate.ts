// Translation check on the parallel FLEURS sentences: translate the human text of one language and compare with the human text of the other
// (chrF, 0-100, rough similarity — NOT a quality verdict; native reviewers decide quality). Also records whether the safety layer let the
// sentence through. Usage: EVAL_DATA=... SAATHI_SECRET=... npx tsx eval/e2e/translate.ts
import { loadItems, chrf } from './lib.ts';
const base = process.env.SAATHI_URL ?? 'https://gulfsaathione.vercel.app', secret = process.env.SAATHI_SECRET!;
const items = loadItems(process.env.EVAL_DATA!).filter(i => i.pack === 'parallel9');
const bySent = new Map<string, Map<string, string>>();
for (const i of items) { const m = bySent.get(i.meta!.sentence) ?? new Map(); m.set(i.lang, i.ref); bySent.set(i.meta!.sentence, m); }
async function call(body: Record<string, string>) {
  const r = await fetch(base + '/tools/translate', { method: 'POST', headers: { 'content-type': 'application/json', 'x-saathi-secret': secret }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) });
  return (await r.json()) as Record<string, string>;
}
const rows: string[][] = [['sentence', 'direction', 'status', 'chrF vs human', 'back-translation kept meaning? (needs a reviewer)']];
let passed = 0, total = 0;
for (const [sent, langs] of bySent) {
  const te = langs.get('te')!;
  for (const target of ['ar', 'en', 'hi', 'ml', 'ur'].filter(l => langs.has(l))) {
    total++; const r = await call({ caller_said: te, target_lang: target });
    const hyp = r.say_to_other ?? ''; if (r.status === 'translated') passed++;
    rows.push([sent, `te→${target}`, r.status, r.status === 'translated' ? chrf(langs.get(target)!, hyp).toFixed(1) : '—', r.status === 'translated' ? 'unchecked' : 'blocked: ' + (r.say_to_worker ?? '').slice(0, 40)]);
  }
  for (const source of ['ar', 'en'].filter(l => langs.has(l))) {
    total++; const r = await call({ other_said: langs.get(source)!, target_lang: source });
    const hyp = r.say_to_worker ?? ''; if (r.status === 'translated') passed++;
    rows.push([sent, `${source}→te`, r.status, r.status === 'translated' ? chrf(te, hyp).toFixed(1) : '—', 'unchecked']);
  }
}
const w = rows[0].map((_, c) => Math.max(...rows.map(r => (r[c] ?? '').length)));
for (const [ri, r] of rows.entries()) { console.log('| ' + r.map((x, c) => x.padEnd(w[c])).join(' | ') + ' |'); if (ri === 0) console.log('|' + w.map(n => '-'.repeat(n + 2)).join('|') + '|'); }
console.log(`\n${passed}/${total} sentence directions passed the safety layer (2 distinct sentences; not a translation-quality score).`);
