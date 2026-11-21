// L2: sound-based matching for Indian names and places.
// Telugu is written by sound (aksharalu/gunintalu), and romanized Telugu has many spellings
// for the same sound. We fold spellings into a phonetic key and compare keys, so
// "Kodimyal", "Kodimial" and an ASR's "Cody meal" all land on the same place.

import type { Token } from './tokens.ts';
import type { Entity } from './types.ts';
import { STOPWORDS } from './lexicon.ts';

export function phoneticKey(input: string): string {
  let s = input.toLowerCase().replace(/[^a-z]/g, '');
  s = s.replace(/ch/g, 'C').replace(/sh/g, 's').replace(/ph/g, 'f').replace(/bh/g, 'b').replace(/dh/g, 'd')
    .replace(/th/g, 't').replace(/kh/g, 'k').replace(/gh/g, 'g').replace(/jh/g, 'j').replace(/zh/g, 'j')
    .replace(/ck/g, 'k').replace(/q/g, 'k').replace(/x/g, 'ks').replace(/c/g, 'k').replace(/C/g, 'c')
    .replace(/w/g, 'v').replace(/z/g, 'j').replace(/y/g, 'i')
    .replace(/ee/g, 'i').replace(/oo/g, 'u').replace(/aa/g, 'a').replace(/ou/g, 'u').replace(/ea/g, 'i')
    .replace(/h/g, '');
  s = s.replace(/(.)\1+/g, '$1');
  return s;
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

export function similarity(a: string, b: string): number {
  const ka = phoneticKey(a), kb = phoneticKey(b);
  if (!ka || !kb) return 0;
  return 1 - levenshtein(ka, kb) / Math.max(ka.length, kb.length);
}

export interface Target { text: string; type: 'place' | 'name'; fromContext: boolean; canonical?: string }

/**
 * Find names/places in the token stream.
 * fuzzy=false -> exact (case-insensitive) matches only (what a plain pipeline sees).
 * fuzzy=true  -> phonetic repair; context targets (L0) get a lower threshold.
 */
export function findNamesAndPlaces(tokens: Token[], consumed: Set<number>, targets: Target[], fuzzy: boolean): Entity[] {
  const out: Entity[] = [];
  const taken = new Set<number>();
  const prepared = targets.map(t => ({ ...t, key: phoneticKey(t.text), words: t.text.toLowerCase().split(/\s+/).length }));

  for (const size of [3, 2, 1]) {
    for (let i = 0; i + size <= tokens.length; i++) {
      const span = tokens.slice(i, i + size);
      if (span.some(t => consumed.has(t.i) || taken.has(t.i) || STOPWORDS.has(t.norm) || /\d/.test(t.norm))) continue;
      let joined = span.map(t => t.norm).join('');
      if (joined.length < 4) continue;
      const stripped = joined.replace(/(loni|lone|lo|nundi|nunchi|ki|ku|ke|ni|se|mein|me)$/, '');
      if (size === 1 && stripped !== joined && stripped.length >= 4 && prepared.some(t => t.text.toLowerCase().replace(/\s+/g, '') === stripped)) joined = stripped;
      const surface = span.map(t => t.raw).join(' ');
      let best: { t: typeof prepared[number]; score: number } | undefined;
      for (const t of prepared) {
        const exact = joined === t.text.toLowerCase().replace(/\s+/g, '');
        if (exact) { best = { t, score: 1 }; break; }
        if (!fuzzy) continue;
        // don't let a 1-token candidate swallow a multi-word target or vice versa by too much
        if (Math.abs(t.words - size) > 1) continue;
        const kj = phoneticKey(joined);
        if (kj.length < 4) continue;
        const score = 1 - levenshtein(kj, t.key) / Math.max(kj.length, t.key.length);
        const threshold = t.fromContext ? 0.74 : t.key.length <= 5 ? 0.88 : 0.8;
        if (score >= threshold && (!best || score > best.score)) best = { t, score };
      }
      if (!best) continue;
      for (const t of span) taken.add(t.i);
      out.push({
        type: best.t.type, start: i, end: i + size, text: best.t.canonical ?? best.t.text, surface,
        layer: best.score === 1 ? 'L2-lexicon' : best.t.fromContext ? 'L0-context' : 'L2-phonetic',
        changed: best.score < 1 || (best.t.canonical !== undefined && best.t.canonical !== surface), score: Number(best.score.toFixed(2)),
        risky: best.score < 0.8,
      });
    }
  }
  return out;
}
