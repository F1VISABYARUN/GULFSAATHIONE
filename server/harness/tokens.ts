// Tokenization shared by every harness layer.
// We keep the original surface form and a normalized form for matching.

import { toLatin } from './translit.ts';

export interface Token {
  i: number;        // index in token array
  raw: string;      // original text (with punctuation)
  norm: string;     // lowercase, punctuation stripped, digit commas removed
}

export function tokenize(text: string): Token[] {
  // raw keeps the original script (for display); norm is Roman (for matching)
  const parts = text
    .replace(/₹/g, ' rs ')
    .replace(/(\d)\s*k\b/gi, '$1k')
    .replace(/[।॥]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  return parts.map((raw, i) => ({ i, raw, norm: normalizeWord(toLatin(raw)) })).filter(t => t.norm.length > 0)
    .map((t, i) => ({ ...t, i }));
}

export function normalizeWord(w: string): string {
  let s = w.toLowerCase();
  s = s.replace(/(\d),(?=\d)/g, '$1');          // 1,50,000 -> 150000
  s = s.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''); // trim punctuation
  s = s.replace(/[-'’]/g, '');
  return s;
}

/** Normalize a whole string for comparison (scoring, term matching). */
export function normalizeText(text: string): string {
  return tokenize(text).map(t => t.norm).join(' ');
}

/**
 * Join runs of single spelled letters: "e c n r" -> "ecnr", "s b i n" -> "sbin".
 * Leaves the English article "a" and pronoun "i" alone when they stand alone.
 */
export function joinSpelledLetters(tokens: Token[]): Token[] {
  const out: Token[] = [];
  let k = 0;
  while (k < tokens.length) {
    if (/^[a-z]$/.test(tokens[k].norm)) {
      let j = k;
      while (j < tokens.length && /^[a-z]$/.test(tokens[j].norm)) j++;
      if (j - k >= 2) {
        const joined = tokens.slice(k, j).map(t => t.norm).join('');
        out.push({ i: 0, raw: joined.toUpperCase(), norm: joined });
        k = j;
        continue;
      }
    }
    out.push(tokens[k]);
    k++;
  }
  return out.map((t, i) => ({ ...t, i }));
}
