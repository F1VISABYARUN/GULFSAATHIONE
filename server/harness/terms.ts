// L2 Gulf-term lock + L3 meaning guard (distress, self-correction).

import type { Token } from './tokens.ts';
import type { Entity, Revision } from './types.ts';
import { GULF_TERMS, DISTRESS_PHRASES, CORRECTION_MARKERS, JOB_WORDS } from './lexicon.ts';
import { phoneticKey, levenshtein } from './phonetic.ts';

function matchSeq(tokens: Token[], i: number, words: string[], consumed: Set<number>): boolean {
  if (i + words.length > tokens.length) return false;
  for (let k = 0; k < words.length; k++) {
    if (consumed.has(i + k) || tokens[i + k].norm !== words[k]) return false;
  }
  return true;
}

// ---------------------------------------------------------------- Gulf terms
export function findGulfTerms(tokens: Token[], consumed: Set<number>, fuzzy: boolean): Entity[] {
  const out: Entity[] = [];
  const candidates = GULF_TERMS.flatMap(term => [
    ...term.variants.map(v => ({ term, words: v.split(' '), asr: false })),
    ...(fuzzy ? (term.asr ?? []).map(v => ({ term, words: v.split(' '), asr: true })) : []),
  ]).sort((a, b) => b.words.length - a.words.length);

  const used = new Set<number>();
  for (let i = 0; i < tokens.length; i++) {
    if (used.has(i)) continue;
    let hit: { term: typeof GULF_TERMS[number]; len: number; asr: boolean; score: number } | undefined;
    for (const c of candidates) {
      if (matchSeq(tokens, i, c.words, new Set([...consumed, ...used]))) { hit = { term: c.term, len: c.words.length, asr: c.asr, score: 1 }; break; }
    }
    // single-token phonetic fallback for longer terms: "huroobu", "kafeelu"
    if (!hit && fuzzy && !consumed.has(i) && tokens[i].norm.length >= 5) {
      const k = phoneticKey(tokens[i].norm);
      for (const term of GULF_TERMS) {
        if (term.canonical.includes(' ') || term.canonical.length < 5) continue;
        const tk = phoneticKey(term.canonical);
        const score = 1 - levenshtein(k, tk) / Math.max(k.length, tk.length);
        if (score >= 0.8) { hit = { term, len: 1, asr: true, score }; break; }
      }
    }
    if (!hit) continue;
    for (let k = i; k < i + hit.len; k++) used.add(k);
    const surface = tokens.slice(i, i + hit.len).map(t => t.raw).join(' ');
    const isPassport = hit.term.id === 'ecr' || hit.term.id === 'ecnr';
    out.push({
      type: isPassport ? 'passportType' : 'gulf', start: i, end: i + hit.len, text: hit.term.canonical, surface,
      value: hit.term.id, layer: hit.asr ? 'L2-gulf-repair' : 'L2-gulf', changed: hit.asr || surface.toLowerCase() !== hit.term.canonical.toLowerCase(),
      score: hit.score,
    });
  }
  return out;
}

export function gulfTermById(id: string) { return GULF_TERMS.find(t => t.id === id); }

// ---------------------------------------------------------------- jobs
export function findJobs(tokens: Token[], consumed: Set<number>): Entity[] {
  return tokens.filter(t => !consumed.has(t.i) && JOB_WORDS[t.norm]).map(t => ({
    type: 'job' as const, start: t.i, end: t.i + 1, text: JOB_WORDS[t.norm], surface: t.raw, layer: 'L2-lexicon', changed: false,
  }));
}

// ---------------------------------------------------------------- distress
export function findDistress(tokens: Token[], fuzzy: boolean): Entity[] {
  const out: Entity[] = [];
  const none = new Set<number>();
  for (const group of DISTRESS_PHRASES) {
    for (const phrase of group.phrases) {
      const words = phrase.split(' ');
      for (let i = 0; i < tokens.length; i++) {
        let ok = matchSeq(tokens, i, words, none);
        let score = 1;
        // fuzzy: allow small spelling drift on long Telugu verbs ("kodtunnaru", "kapaadandi")
        if (!ok && fuzzy && i + words.length <= tokens.length) {
          const cand = tokens.slice(i, i + words.length).map(t => t.norm).join(' ');
          const a = phoneticKey(cand), b = phoneticKey(phrase);
          if (a.length >= 6) {
            score = 1 - levenshtein(a, b) / Math.max(a.length, b.length);
            ok = score >= 0.84;
          }
        }
        if (!ok) continue;
        if (out.some(e => e.start <= i && i < e.end && e.value === group.kind)) continue;
        out.push({
          type: 'distress', start: i, end: i + words.length, text: group.kind, surface: tokens.slice(i, i + words.length).map(t => t.raw).join(' '),
          value: group.kind, layer: score === 1 ? 'L3-distress' : 'L3-distress-fuzzy', changed: false, score: Number(score.toFixed(2)),
        });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------- self-correction
const GROUP = (e: Entity): string => {
  if (e.type === 'gulf') {
    const id = String(e.value);
    return id === 'visit_visa' || id === 'work_visa' ? 'visa' : `gulf:${id}`;
  }
  return e.type;
};
const CORRECTABLE = new Set(['money', 'phone', 'hours', 'place', 'name', 'visa', 'passportType', 'job']);

/**
 * "Tuesday... kadu kadu, Friday" / "oka laksha, sorry, oka laksha yaabhai velu"
 * When a correction marker sits between two values of the same kind, the earlier one is superseded.
 * "make it 3 lakhs, not 2 lakhs" — the value after "not" is superseded.
 */
export function resolveSelfCorrections(tokens: Token[], entities: Entity[]): Revision[] {
  const revisions: Revision[] = [];
  const sorted = [...entities].sort((a, b) => a.start - b.start);
  const inEntity = (i: number) => sorted.some(e => e.start <= i && i < e.end);

  for (let m = 0; m < tokens.length; m++) {
    if (inEntity(m)) continue;
    const marker = CORRECTION_MARKERS.find(words => words.every((w, k) => tokens[m + k]?.norm === w));
    if (!marker) continue;
    const mEnd = m + marker.length;
    const before = [...sorted].reverse().find(e => e.end <= m && m - e.end <= 6 && CORRECTABLE.has(GROUP(e)) && !e.superseded);
    if (!before) continue;
    const after = sorted.find(e => e.start >= mEnd && e.start - mEnd <= 8 && GROUP(e) === GROUP(before));
    if (!after || after.text === before.text) continue;
    before.superseded = true;
    revisions.push({ type: before.type, from: before.text, to: after.text, marker: marker.join(' ') });
    m = mEnd - 1;
  }

  // "X not Y"  -> Y superseded
  for (let m = 1; m < tokens.length - 1; m++) {
    if (tokens[m].norm !== 'not') continue;
    const before = [...sorted].reverse().find(e => e.end <= m && m - e.end <= 1);
    const after = sorted.find(e => e.start > m && e.start - m <= 2);
    if (before && after && GROUP(before) === GROUP(after) && !after.superseded && before.text !== after.text) {
      after.superseded = true;
      revisions.push({ type: after.type, from: after.text, to: before.text, marker: 'not' });
    }
  }
  return revisions;
}
