// Score the cached transcripts. Usage: EVAL_DATA=... EVAL_CACHE=... npx tsx eval/e2e/score.ts [outDir]
// Prints one table per pack. Packs are never pooled: each has its own denominator and its own caveats.
import { writeFileSync, mkdirSync } from 'node:fs';
import { loadItems, cached, norm, wer, cer, chrf, mean, pct, MODELS, type Item } from './lib.ts';
import { runHarness, ALL_ON } from '../../server/harness/index.ts';
import { tokenize } from '../../server/harness/tokens.ts';
import { numberValues } from '../../server/harness/numbers.ts';
import { phoneticKey } from '../../server/harness/phonetic.ts';
import { detectIntent } from '../../server/assistant.ts';

const root = process.env.EVAL_DATA!; if (!root) { console.error('Set EVAL_DATA'); process.exit(2); }
const items = loadItems(root);
const out: Record<string, unknown> = {};
const get = (it: Item, m: string) => cached(it, m)?.text;

/** Facts the harness finds in a text, as comparable strings. Digits are compared, never printed. */
function facts(text: string): Set<string> {
  const h = runHarness(text, {}, ALL_ON), f = new Set<string>();
  for (const e of h.entities) {
    if (e.superseded) continue;
    if (e.type === 'money') f.add('money:' + (e.value as { amount: number }).amount);
    if (e.type === 'phone') f.add('phone:' + (e.value as { digits: string }).digits);
    if (e.type === 'idnumber') f.add('id:' + (e.value as { digits: string }).digits);
    if (e.type === 'gulf') f.add('gulf:' + String(e.value));
    if (e.type === 'place') f.add('place:' + e.text);
  }
  return f;
}
const cat = (k: string) => k.split(':')[0];
function compare(ref: string, hyp: string) {
  const R = facts(ref), H = facts(hyp), res: Record<string, { matched: number; missed: number; invented: number }> = {};
  const bump = (k: string, f: 'matched' | 'missed' | 'invented') => { (res[cat(k)] ??= { matched: 0, missed: 0, invented: 0 })[f]++; };
  for (const k of R) bump(k, H.has(k) ? 'matched' : 'missed');
  for (const k of H) if (!R.has(k)) bump(k, 'invented');
  return res;
}
function addFacts(acc: Record<string, { matched: number; missed: number; invented: number }>, r: ReturnType<typeof compare>) {
  for (const [k, v] of Object.entries(r)) { const a = (acc[k] ??= { matched: 0, missed: 0, invented: 0 }); a.matched += v.matched; a.missed += v.missed; a.invented += v.invented; }
}
const digitsOf = (s: string) => (s.normalize('NFC').match(/\d[\d,]*/g) ?? []).map(x => x.replace(/,/g, '')).filter(x => x.length >= 2);
const values = (s: string) => numberValues(tokenize(s));
/** Script-insensitive key: a Latin word in the reference matches the same word written in Telugu letters. */
const pkey = (t: string) => phoneticKey(tokenize(t)[0]?.norm ?? t);
const kind = (tok: string) => (/\d/.test(tok) ? 'digit-token' : /[a-z]/i.test(tok) ? 'english/latin' : 'telugu');

// ---------------------------------------------------------------- A) FLEURS Telugu read speech (60 sentences x 3 conditions)
{
  const rows: string[][] = [['model', 'condition', 'n', 'WER', 'CER', 'WER after harness', 'numbers by value', 'ref words missed (script-insensitive): telugu / english-latin / digit tokens', 'invented facts (money/phone/id/gulf/place)']];
  const detail: unknown[] = [];
  for (const m of MODELS) for (const cond of ['clean_16k', 'phone_8k', 'phone_8k_noisy']) {
    const set = items.filter(i => i.pack === 'fleurs60' && i.cond === cond && get(i, m) !== undefined);
    if (!set.length) continue;
    const w = set.map(i => wer(i.ref, get(i, m)!)), c = set.map(i => cer(i.ref, get(i, m)!));
    const wh = set.map(i => wer(i.ref, runHarness(get(i, m)!, {}, ALL_ON).corrected));
    let numTot = 0, numHit = 0; const miss = { telugu: [0, 0], 'english/latin': [0, 0], 'digit-token': [0, 0] } as Record<string, number[]>;
    const acc: Record<string, { matched: number; missed: number; invented: number }> = {};
    for (const i of set) {
      const hyp = norm(get(i, m)!), hypBag = new Map<string, number>(); for (const t of hyp.split(' ')) hypBag.set(t, (hypBag.get(t) ?? 0) + 1);
      // numbers compared by value (digits or spoken words), so "1,400" = "1400" = "పద్నాలుగు వందలు"; run-together words are not parsed (a harness limit too)
      const hv = new Map<number, number>(); for (const v of values(get(i, m)!)) hv.set(v, (hv.get(v) ?? 0) + 1);
      for (const v of values(i.ref)) { numTot++; if ((hv.get(v) ?? 0) > 0) { numHit++; hv.set(v, hv.get(v)! - 1); } }
      const hk = new Map<string, number>(); for (const t of norm(get(i, m)!).split(' ').filter(Boolean)) hk.set(pkey(t), (hk.get(pkey(t)) ?? 0) + 1);
      for (const t of norm(i.ref).split(' ').filter(Boolean)) { const k = kind(t); miss[k][1]++; const key = pkey(t); if (!(hk.get(key))) miss[k][0]++; else hk.set(key, hk.get(key)! - 1); }
      addFacts(acc, compare(i.ref, get(i, m)!));
      detail.push({ m, cond, id: i.id, wer: wer(i.ref, get(i, m)!) });
    }
    const inv = Object.entries(acc).filter(([k]) => ['money', 'phone', 'id', 'gulf', 'place'].includes(k)).map(([k, v]) => `${k}:${v.invented}`).join(' ');
    rows.push([m, cond, String(set.length), pct(mean(w)), pct(mean(c)), pct(mean(wh)), `${numHit}/${numTot}`, `${pct(miss.telugu[0] / miss.telugu[1])} / ${pct(miss['english/latin'][0] / miss['english/latin'][1])} / ${pct(miss['digit-token'][0] / miss['digit-token'][1])}`, inv || '0']);
  }
  console.log('\n## A. FLEURS Telugu read speech — 60 distinct sentences, each at 3 conditions (read Wikipedia text, NOT worker calls)\n'); table(rows);
  out.fleurs60 = { rows, detail };
}

// ---------------------------------------------------------------- B) IndicVoices Telugu (10 clips; only 01-04 are phone role-plays)
{
  const rows: string[][] = [['clip', 'type', 's', ...MODELS.map(m => m + ' WER')]];
  for (const i of items.filter(i => i.pack === 'indicvoices10')) {
    rows.push([i.id.replace('iv_te_', ''), Number(i.meta!.duration_s) > 0 && /0[1-4]_/.test(i.id) ? '8k phone' : '44k', i.meta!.duration_s, ...MODELS.map(m => { const t = get(i, m); return t === undefined ? '—' : pct(wer(i.ref, t)); })]);
  }
  console.log('\n## B. IndicVoices Telugu — 10 clips (whole-file reference, not time-aligned; 01 reference seems one-sided)\n'); table(rows);
  // digit-bearing clips: do the digit facts survive? (digits are not printed; personal data)
  const drows: string[][] = [['clip', 'model', 'reference facts', 'found in ASR', 'ASR invented', 'note']];
  for (const i of items.filter(i => /iv_te_(06|07|08|10)/.test(i.id))) for (const m of MODELS) {
    const t = get(i, m); if (t === undefined) continue;
    const R = facts(i.ref), H = facts(t); const matched = [...R].filter(k => H.has(k)).length;
    const note = /iv_te_07/.test(i.id) ? 'reference has 11 spoken digits (dataset oddity); correct behaviour is a read-back, not a silent fix' : '';
    drows.push([i.id.replace('iv_te_', ''), m, String(R.size), `${matched}/${R.size}`, String([...H].filter(k => !R.has(k)).length), note]);
  }
  console.log('\nFacts the harness finds in the human transcript vs in each ASR output (digit values withheld):\n'); table(drows);
  out.indicvoices10 = { rows, drows };
}

// ---------------------------------------------------------------- C) Arabic place requests (3 clips)
{
  const rows: string[][] = [['clip', 'expected action', 'model', 'WER vs ref', 'landmark/key term heard', 'intent on ASR text', 'intent on reference']];
  const key: Record<string, RegExp> = { dir_ar_01: /برج\s*خليفة/, dir_ar_02: /الراجحي/, dir_ar_03: /الرياض.*مكة|مكة.*الرياض/ };
  for (const i of items.filter(i => i.pack === 'arabic_places3')) for (const m of MODELS) {
    const t = get(i, m); if (t === undefined) continue;
    rows.push([i.id, i.meta!.expected, m, pct(wer(i.ref, t)), key[i.id].test(t) ? 'yes' : 'NO', detectIntent(t), detectIntent(i.ref)]);
  }
  console.log('\n## C. Arabic place requests — 3 clips (Saudi dataset; speakers not verified as Gulf)\n'); table(rows);
  out.arabic_places3 = { rows };
}

// ---------------------------------------------------------------- D) parallel sentences (9 clips, 2 sentences)
{
  const rows: string[][] = [['clip', 'lang', ...MODELS.map(m => m + ' WER / CER')]];
  for (const i of items.filter(i => i.pack === 'parallel9')) rows.push([i.id.replace('fleurs_', ''), i.lang, ...MODELS.map(m => { const t = get(i, m); return t === undefined ? '—' : `${pct(wer(i.ref, t))} / ${pct(cer(i.ref, t))}`; })]);
  console.log('\n## D. FLEURS parallel read sentences — 9 clips, only 2 distinct sentences (speech recognition only; translation is scored in translate.ts)\n'); table(rows);
  out.parallel9 = { rows };
}

function table(rows: string[][]) { const w = rows[0].map((_, c) => Math.max(...rows.map(r => (r[c] ?? '').length))); for (const [ri, r] of rows.entries()) { console.log('| ' + r.map((x, c) => x.padEnd(w[c])).join(' | ') + ' |'); if (ri === 0) console.log('|' + w.map(n => '-'.repeat(n + 2)).join('|') + '|'); } }
const dir = process.argv[2]; if (dir) { mkdirSync(dir, { recursive: true }); writeFileSync(dir + '/report.json', JSON.stringify(out, null, 1)); }
