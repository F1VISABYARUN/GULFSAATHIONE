// Shared pieces of the end-to-end benchmark: dataset loaders, text metrics, and the speech-to-text client.
// Audio and references stay outside git (EVAL_DATA); transcripts are cached outside git too (EVAL_CACHE).
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';

export interface Item { id: string; pack: 'fleurs60' | 'indicvoices10' | 'arabic_places3' | 'parallel9'; cond: string; file: string; ref: string; lang: string; meta?: Record<string, string> }

// ---------------------------------------------------------------- loaders
function csv(text: string): Record<string, string>[] {
  const rows: string[][] = []; let cur: string[] = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true; else if (c === ',') { cur.push(cell); cell = ''; }
    else if (c === '\n') { cur.push(cell); rows.push(cur); cur = []; cell = ''; } else if (c !== '\r') cell += c;
  }
  if (cell || cur.length) { cur.push(cell); rows.push(cur); }
  const [h, ...b] = rows; return b.filter(r => r.length > 1).map(r => Object.fromEntries(h.map((k, i) => [k, r[i] ?? ''])));
}
const sub = (root: string, prefix: string) => { const d = readdirSync(root).find(n => n.includes(prefix)); if (!d) throw Error(`pack ${prefix} not found in ${root}`); const inner = join(root, d); const only = readdirSync(inner); return only.length === 1 ? join(inner, only[0]) : inner; };

export function loadItems(root: string): Item[] {
  const items: Item[] = [];
  const f = sub(root, 'test-audio');
  for (const r of csv(readFileSync(join(f, 'truth.csv'), 'utf8')))
    for (const cond of ['clean_16k', 'phone_8k', 'phone_8k_noisy'])
      items.push({ id: `${r.clip_id}/${cond}`, pack: 'fleurs60', cond, file: join(f, cond, r.clip_id + '.wav'), ref: r.telugu_text, lang: 'te', meta: { has_digits: r.has_digits, english_words: r.english_words } });
  const b1 = sub(root, 'batch1-telugu');
  for (const r of csv(readFileSync(join(b1, 'manifest.csv'), 'utf8'))) {
    const base = r.clip_id; items.push({ id: base, pack: 'indicvoices10', cond: r.category || 'clip', file: join(b1, base + '.wav'), ref: readFileSync(join(b1, base + '.txt'), 'utf8').trim(), lang: 'te', meta: { duration_s: r.duration_s, what: r.what_to_evaluate } });
  }
  const b2 = sub(root, 'batch2-parallel');
  for (const r of csv(readFileSync(join(b2, 'arabic_place_requests', 'manifest.csv'), 'utf8')))
    items.push({ id: r.clip_id, pack: 'arabic_places3', cond: 'ar-SA', file: join(b2, r.local_file), ref: r.what_to_evaluate.match(/transcript\s+"([^"]+)"/)?.[1] ?? '', lang: 'ar', meta: { expected: r.expected_next_action, what: r.what_to_evaluate } });
  const refs = readFileSync(join(b2, 'parallel', 'references.tsv'), 'utf8').trim().split('\n'); const hdr = refs[0].split('\t');
  for (const line of refs.slice(1)) { const c = line.split('\t'); const o = Object.fromEntries(hdr.map((k, i) => [k, c[i]])); const lang = o.lang.split('_')[0];
    items.push({ id: o.local_file.replace('.wav', ''), pack: 'parallel9', cond: o.lang, file: join(b2, 'parallel', o.local_file), ref: o.reference_text, lang, meta: { sentence: o.sentence_id } }); }
  return items;
}

// ---------------------------------------------------------------- metrics
export function norm(s: string): string {
  return s.normalize('NFC').replace(/[​-‍﻿]/g, '').replace(/[ً-ٰٟ]/g, '').toLowerCase().replace(/[\p{P}\p{S}]/gu, ' ').replace(/\s+/g, ' ').trim();
}
function lev<T>(a: T[], b: T[]): number {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) { let prev = dp[0]; dp[0] = i; for (let j = 1; j <= b.length; j++) { const t = dp[j]; dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; } }
  return dp[b.length];
}
export const wer = (ref: string, hyp: string) => { const r = norm(ref).split(' ').filter(Boolean); return r.length ? lev(r, norm(hyp).split(' ').filter(Boolean)) / r.length : NaN; };
export const cer = (ref: string, hyp: string) => { const r = [...norm(ref).replace(/ /g, '')]; return r.length ? lev(r, [...norm(hyp).replace(/ /g, '')]) / r.length : NaN; };
/** chrF (character n-gram F-score, beta=2), 0-100. Rough similarity for translations, not a quality verdict. */
export function chrf(ref: string, hyp: string, maxN = 6): number {
  const R = norm(ref).replace(/ /g, ''), H = norm(hyp).replace(/ /g, ''); if (!R || !H) return 0;
  let p = 0, r = 0, n = 0;
  for (let k = 1; k <= maxN; k++) {
    const grams = (s: string) => { const m = new Map<string, number>(); for (let i = 0; i + k <= s.length; i++) m.set(s.slice(i, i + k), (m.get(s.slice(i, i + k)) ?? 0) + 1); return m; };
    const gr = grams(R), gh = grams(H); if (!gr.size || !gh.size) continue;
    let match = 0; for (const [g, c] of gh) match += Math.min(c, gr.get(g) ?? 0);
    p += match / [...gh.values()].reduce((a, b) => a + b, 0); r += match / [...gr.values()].reduce((a, b) => a + b, 0); n++;
  }
  if (!n) return 0; p /= n; r /= n; return p + r === 0 ? 0 : (100 * 5 * p * r) / (4 * p + r);
}
export const mean = (a: number[]) => { const x = a.filter(Number.isFinite); return x.length ? x.reduce((s, v) => s + v, 0) / x.length : NaN; };
export const pct = (x: number) => (Number.isFinite(x) ? (100 * x).toFixed(1) + '%' : 'n/a');

// ---------------------------------------------------------------- speech-to-text client (our guarded endpoint)
export const MODELS = ['gpt-4o-transcribe', 'gpt-4o-mini-transcribe', 'whisper-1'];
export function cacheDir() { const d = process.env.EVAL_CACHE || join(import.meta.dirname ?? '.', 'cache'); mkdirSync(d, { recursive: true }); return d; }
const key = (it: Item, model: string) => `${model}__${it.id.replace(/[^\w.-]/g, '_')}.json`;
export function cached(it: Item, model: string): { text: string; ms: number } | undefined { const p = join(cacheDir(), key(it, model)); return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : undefined; }
/** Vercel rejects request bodies over ~4.5 MB. Long 44 kHz clips are re-encoded to 16 kHz mono FLAC (the same for every model). */
function uploadable(file: string): string {
  if (statSync(file).size < 3_500_000) return file;
  const out = join(cacheDir(), 'conv_' + file.split('/').pop()!.replace(/\.\w+$/, '.flac'));
  if (!existsSync(out)) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', file, '-ac', '1', '-ar', '16000', out]);
  return out;
}
export async function transcribe(it: Item, model: string, base: string, secret: string): Promise<{ text: string; ms: number } | { error: string }> {
  const hit = cached(it, model); if (hit) return hit;
  const form = new FormData(); const up = uploadable(it.file); form.append('model', model); if (model !== 'whisper-1') form.append('language', it.lang); /* whisper-1 rejects 'te': auto-detect */ form.append('audio', new Blob([readFileSync(up)]), up.split('/').pop()!);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(base + '/api/saathi/stt', { method: 'POST', headers: { 'x-saathi-secret': secret }, body: form, signal: AbortSignal.timeout(70000) });
      const j: any = await r.json().catch(() => ({}));
      if (r.ok) { const out = { text: String(j.text ?? ''), ms: Number(j.ms ?? 0) }; writeFileSync(join(cacheDir(), key(it, model)), JSON.stringify(out)); return out; }
      if (r.status < 500 && r.status !== 429) return { error: `${r.status} ${j.error ?? ''}` };
    } catch { /* retry */ }
    await new Promise(res => setTimeout(res, 1500 * (attempt + 1)));
  }
  return { error: 'failed after retries' };
}
