// Scoring: what matters is meaning and risk, not just words.

import { normalizeText } from '../server/harness/tokens.ts';
import { similarity } from '../server/harness/phonetic.ts';
import type { CaseSlots } from '../server/harness/types.ts';

export function wer(reference: string, hypothesis: string): number {
  const r = normalizeText(reference).split(' ').filter(Boolean);
  const h = normalizeText(hypothesis).split(' ').filter(Boolean);
  if (!r.length) return h.length ? 1 : 0;
  const dp = Array.from({ length: h.length + 1 }, (_, j) => j);
  for (let i = 1; i <= r.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= h.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (r[i - 1] === h[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[h.length] / r.length;
}

/** Critical words (names, places, Gulf terms, distress words) present in the output text. */
export function criticalTermHits(terms: string[], output: string): { hit: string[]; miss: string[] } {
  const text = ` ${normalizeText(output)} `;
  const hit: string[] = [], miss: string[] = [];
  for (const t of terms) (text.includes(` ${normalizeText(t)} `) ? hit : miss).push(t);
  return { hit, miss };
}

export interface SlotError { slot: string; expected: unknown; got: unknown }

/** Meaning-changed errors: every expected fact that came out wrong or missing. */
export function slotErrors(expected: Partial<CaseSlots>, got: CaseSlots): SlotError[] {
  const errors: SlotError[] = [];
  for (const [k, exp] of Object.entries(expected)) {
    const g = (got as Record<string, unknown>)[k];
    if (!sameValue(exp, g)) errors.push({ slot: k, expected: exp, got: g });
  }
  return errors;
}

function sameValue(exp: unknown, got: unknown): boolean {
  if (got === undefined || got === null) return exp === undefined;
  if (typeof exp === 'number') return Number(got) === exp;
  if (typeof exp === 'boolean') return got === exp;
  if (typeof exp === 'string') return typeof got === 'string' && (got.toLowerCase() === exp.toLowerCase() || similarity(got, exp) >= 0.85);
  if (Array.isArray(exp)) {
    if (!Array.isArray(got)) return false;
    return exp.every(e => got.some(g => sameValue(e, g)));
  }
  if (exp && typeof exp === 'object') {
    const eo = exp as Record<string, unknown>, go = got as Record<string, unknown>;
    return Object.keys(eo).every(k => sameValue(eo[k], go?.[k]));
  }
  return false;
}

export function riskScore(expected: string[], detected: string[]) {
  const caught = expected.filter(r => detected.includes(r));
  const missed = expected.filter(r => !detected.includes(r));
  const falseAlarms = detected.filter(r => !expected.includes(r));
  return { caught, missed, falseAlarms };
}
