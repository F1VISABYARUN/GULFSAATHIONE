// L2: deterministic number layers — phone numbers, money, hours.
// Pure code: instant, testable, never hallucinates.

import type { Token } from './tokens.ts';
import {
  UNIT_WORDS, HUNDRED_WORDS, MULTIPLIER_WORDS, FRACTION_WORDS, MODIFIER_WORDS, CURRENCY_WORDS,
  DIGIT_WORDS, PHONE_TENS, REPEAT_WORDS, FILLERS, HOUR_WORDS, ID_CUES, TIME_WORDS, FEE_WORDS, SALARY_WORDS, MONEY_CUES,
} from './lexicon.ts';
import type { Entity } from './types.ts';

// ---------------------------------------------------------------- phones
export interface PhoneValue {
  digits: string;
  e164?: string;
  country?: 'IN' | 'AE' | 'SA' | 'GULF';
  valid: boolean;
  issue?: string;
  kind?: 'phone' | 'id12' | 'long';   // id12: 12 digits that are not a country-coded phone (Aadhaar/UAN-sized)
}

export function classifyPhone(raw: string): PhoneValue {
  let d = raw;
  if (d.length === 12 && d.startsWith('971')) return { digits: d, e164: '+' + d, country: 'AE', valid: d[3] === '5', issue: d[3] === '5' ? undefined : 'UAE mobile should start with 5' };
  if (d.length === 12 && d.startsWith('966')) return { digits: d, e164: '+' + d, country: 'SA', valid: d[3] === '5', issue: d[3] === '5' ? undefined : 'Saudi mobile should start with 5' };
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0') && /[6-9]/.test(d[1])) d = d.slice(1);
  if (d.length === 10 && /^[6-9]/.test(d)) return { digits: d, e164: `+91 ${d.slice(0, 5)} ${d.slice(5)}`, country: 'IN', valid: true };
  if (d.length === 10 && d.startsWith('05')) return { digits: d, country: 'GULF', valid: true, issue: 'Gulf mobile — country (UAE/Saudi) not stated' };
  if (d.length === 9 && d.startsWith('5')) return { digits: d, country: 'GULF', valid: true, issue: 'Gulf mobile — country (UAE/Saudi) not stated' };
  if (raw.length === 12) return { digits: raw, valid: false, kind: 'id12', issue: '12 digits — not a phone number; Aadhaar or UAN sized' };
  return { digits: raw, valid: false, kind: 'long', issue: `${raw.length} digits heard — an Indian mobile needs 10` };
}

const MAX_DIGIT_TOKEN = 18;
/** Look back a few tokens for a word that names an identifier ("UAN number ...", "account no ..."). */
function idCue(tokens: Token[], i: number): string | undefined {
  for (let k = i - 1; k >= Math.max(0, i - 4); k--) { const c = ID_CUES.get(tokens[k].norm); if (c) return c; }
  return undefined;
}
export const groupDigits = (d: string) => d.replace(/(\d{4})(?=\d)/g, '$1 ');

export function formatPhone(p: PhoneValue): string {
  if (p.e164) return p.e164;
  return p.digits;
}

/** Find spoken phone numbers: "nine eight four eight double zero ..." / "tommidi enimidi ..." */
// Mishearings of digits seen in real calls ("zero" -> "జూలై"/July). Only used when the harness repairs.
const REPAIR_DIGITS = new Map<string, number>([['joolai', 0], ['july', 0], ['jeero', 0], ['zeero', 0]]);

export function findPhones(tokens: Token[], repair = false): Entity[] {
  const digitOf = (t: string) => DIGIT_WORDS.get(t) ?? DIGIT_WORDS.get(t.replace(/(ki|ku)$/, '')) ?? (repair ? REPAIR_DIGITS.get(t) : undefined);
  const out: Entity[] = [];
  let i = 0;
  while (i < tokens.length) {
    const startsRun = isPhoneToken(tokens, i) || (tokens[i].norm === 'plus' && i + 1 < tokens.length && isPhoneToken(tokens, i + 1));
    if (!startsRun) { i++; continue; }
    let j = tokens[i].norm === 'plus' ? i + 1 : i;
    let digits = '';
    let lastDigitEnd = j;
    while (j < tokens.length) {
      const t = tokens[j].norm;
      if (FILLERS.has(t) && digits.length > 0) { j++; continue; }
      if (REPEAT_WORDS.has(t) && j + 1 < tokens.length) {
        const next = singleDigit(tokens[j + 1].norm);
        if (next !== undefined) { digits += String(next).repeat(REPEAT_WORDS.get(t)!); j += 2; lastDigitEnd = j; continue; }
        break;
      }
      if (/^\d+$/.test(t) && t.length <= MAX_DIGIT_TOKEN) {
        // "1978; 1970" are two years, not one 8-digit number: punctuation ends a run unless it is a comma between single dictated digits
        const prev = j > i ? tokens[j - 1] : undefined;
        if (prev && /\d$/.test(prev.norm) && (/[;:.!?।]$/.test(prev.raw) || (/,$/.test(prev.raw) && prev.norm.length > 1))) break;
        digits += t; j++; lastDigitEnd = j; continue; }
      if (PHONE_TENS.has(t)) {
        const tens = PHONE_TENS.get(t)!;
        const next = j + 1 < tokens.length ? englishUnit(tokens[j + 1].norm) : undefined;
        if (next !== undefined) { digits += `${tens}${next}`; j += 2; } else { digits += `${tens}0`; j++; }
        lastDigitEnd = j; continue;
      }
      const dv = digitOf(t);
      if (dv !== undefined && (DIGIT_WORDS.has(t) || digits.length > 0)) { digits += String(dv); j++; lastDigitEnd = j; continue; }
      break;
    }
    if (digits.length >= 7) {
      const value = classifyPhone(digits);
      const surface = tokens.slice(i, lastDigitEnd).map(t => t.raw).join(' ');
      // "at the rate" (the @ sign, spoken) in its many ASR spellings: "at the rate", "et di ret", "addaret", "attu rate"
      const atRate = /^(at|et|att?u|add?a?)(the|di|da|dh|de)?(rate|rat|ret|reet|reat)/.test(tokens.slice(lastDigitEnd, lastDigitEnd + 3).map(t => t.norm).join(''));
      const cue = idCue(tokens, i) ?? (atRate ? 'UPI handle' : undefined);
      // A named identifier, or 12 digits that are not a country-coded phone, is never stored as a phone number.
      if (cue || value.kind === 'id12') {
        const kind = cue ?? 'ID';
        out.push({ type: 'idnumber', start: i, end: lastDigitEnd, text: groupDigits(digits), surface, value: { kind, digits, named: !!cue }, layer: 'L2-id', changed: false, risky: true });
        i = lastDigitEnd; continue;
      }
      out.push({ type: 'phone', start: i, end: lastDigitEnd, text: formatPhone(value), surface, value, layer: 'L2-phone', changed: surface !== formatPhone(value), risky: !value.valid });
      i = lastDigitEnd;
    } else {
      i++;
    }
  }
  return out;
}

function isPhoneToken(tokens: Token[], i: number): boolean {
  const t = tokens[i].norm;
  if (REPEAT_WORDS.has(t)) return i + 1 < tokens.length && singleDigit(tokens[i + 1].norm) !== undefined;
  // a phone run must start with a digit-ish token; single English/Telugu digit words or digit strings
  return DIGIT_WORDS.has(t) || PHONE_TENS.has(t) || (/^\d+$/.test(t) && t.length <= MAX_DIGIT_TOKEN);
}
function singleDigit(t: string): number | undefined {
  if (/^\d$/.test(t)) return Number(t);
  return DIGIT_WORDS.get(t);
}
function englishUnit(t: string): number | undefined {
  const m: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 };
  return m[t];
}

// ---------------------------------------------------------------- money
export interface MoneyValue { amount: number; currency?: 'INR' | 'AED' | 'SAR' | 'QAR' | 'OMR' | 'KWD' }

export function formatIndian(n: number): string {
  const [int, dec] = String(Math.round(n * 100) / 100).split('.');
  const last3 = int.slice(-3);
  const rest = int.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return (rest ? rest + ',' : '') + last3 + (dec ? '.' + dec : '');
}

export function formatMoney(v: MoneyValue): string {
  if (!v.currency || v.currency === 'INR') return `₹${formatIndian(v.amount)}`;
  return `${v.currency} ${v.amount.toLocaleString('en-US')}`;
}

type NumTok =
  | { k: 'unit'; v: number; digit?: boolean }
  | { k: 'hundred' }
  | { k: 'mult'; v: number }
  | { k: 'frac'; v: number }
  | { k: 'mod'; v: number }
  | { k: 'kilo'; v: number }   // "30k"
  | { k: 'half' }
  | { k: 'and' };

function classifyNum(t: string): NumTok | undefined {
  if (/^\d+(\.\d+)?$/.test(t)) return { k: 'unit', v: Number(t), digit: true };
  const km = t.match(/^(\d+(?:\.\d+)?)k$/);
  if (km) return { k: 'kilo', v: Number(km[1]) * 1000 };
  if (UNIT_WORDS.has(t)) return { k: 'unit', v: UNIT_WORDS.get(t)! };
  if (HUNDRED_WORDS.has(t)) return { k: 'hundred' };
  if (MULTIPLIER_WORDS.has(t)) return { k: 'mult', v: MULTIPLIER_WORDS.get(t)! };
  if (FRACTION_WORDS.has(t)) return { k: 'frac', v: FRACTION_WORDS.get(t)! };
  if (MODIFIER_WORDS.has(t)) return { k: 'mod', v: MODIFIER_WORDS.get(t)! };
  if (t === 'half' || t === 'arra') return { k: 'half' };
  if (t === 'and') return { k: 'and' };
  return undefined;
}

/** Evaluate a run of number tokens with Indian place values (lakh/crore). */
export function evaluateNumberRun(words: string[]): { value: number; hasScale: boolean; hasDigit: boolean } | undefined {
  let total = 0, cur = 0, mod = 0, hasScale = false, hasDigit = false, any = false;
  let prevSingle = false;
  for (const w of words) {
    const n = classifyNum(w);
    if (!n) return undefined;
    const single = n.k === 'unit' && n.v < 10;
    switch (n.k) {
      // "oka rendu lakshalu" = about 2 lakh; "rendu moodu lakshalu" = 2–3 lakh (take the later, higher one)
      case 'unit': cur = single && prevSingle ? n.v : cur + n.v; any = true; if (n.digit) hasDigit = true; break;
      case 'frac': cur += n.v; any = true; break;
      case 'mod': mod = n.v; break;
      case 'half': cur += 0.5; break;
      case 'hundred': cur = (cur || 1) * 100; hasScale = true; any = true; break;
      case 'mult': total += ((cur || 1) + mod) * n.v; cur = 0; mod = 0; hasScale = true; any = true; break;
      case 'kilo': total += n.v; hasScale = true; hasDigit = true; any = true; break;
      case 'and': break;
    }
    prevSingle = single && !(n.k === 'unit' && n.digit);
  }
  if (!any) return undefined;
  return { value: total + cur + (cur ? mod : 0), hasScale, hasDigit };
}

/**
 * Split a run of number words into separate numbers using place value: a unit cannot follow a filled ones place,
 * a tens word cannot follow a filled tens place, and scales must descend (lakh before thousand). This keeps a list read
 * aloud ("sixty four, seven seventy five, thirteen ninety two") from being merged into one giant amount.
 */
export function segmentNumberRun(words: string[]): [number, number][] {
  const segs: [number, number][] = []; let start = 0, cur = 0, lastScale = Infinity, fresh = true;
  for (let k = 0; k < words.length; k++) {
    const n = classifyNum(words[k]); if (!n) continue;
    let split = false;
    if (n.k === 'unit' && n.digit) split = !fresh && !(k + 1 < words.length && ['mult', 'hundred'].includes(classifyNum(words[k + 1])?.k ?? ''));
    else if (n.k === 'unit' && n.v < 10) split = !fresh && cur % 10 !== 0 && !(cur % 10 === 0);
    else if (n.k === 'unit' && n.v >= 10) split = !fresh && cur % 100 !== 0;
    else if (n.k === 'mult') split = n.v >= lastScale;
    else if (n.k === 'hundred') split = !fresh && cur >= 100 && cur % 100 !== 0 ? true : false;
    if (split) { segs.push([start, k]); start = k; cur = 0; lastScale = Infinity; fresh = true; }
    switch (n.k) {
      case 'unit': cur += n.v; fresh = false; break;
      case 'hundred': cur = (cur % 100 === cur ? cur : cur) * 100 || 100; fresh = false; break;
      case 'mult': lastScale = n.v; cur = 0; fresh = false; break;
      default: fresh = false;
    }
  }
  segs.push([start, words.length]); return segs.filter(([x, y]) => y > x);
}

export function findMoney(tokens: Token[], consumed: Set<number>): Entity[] {
  const out: Entity[] = [];
  let i = 0;
  while (i < tokens.length) {
    if (consumed.has(i) || !startsNumber(tokens[i].norm)) { i++; continue; }
    let j = i;
    while (j < tokens.length && !consumed.has(j)) {
      const n = classifyNum(tokens[j].norm);
      if (!n) break;
      if (n.k === 'and' && !(j + 1 < tokens.length && classifyNum(tokens[j + 1].norm) && tokens[j + 1].norm !== 'and')) break;
      j++;
    }
    while (j > i && tokens[j - 1].norm === 'and') j--;
    const runWords = tokens.slice(i, j).map(t => t.norm);
    const runEnd = j;
    for (const [rs, re] of segmentNumberRun(runWords)) {
      const si = i + rs, sj = i + re;
      const words = tokens.slice(si, sj).map(t => t.norm);
      const ev = evaluateNumberRun(words);
      if (!ev) continue;

      // currency: one token before, or up to two after
      let currency: MoneyValue['currency'];
      let start = si, end = sj;
      if (si > 0 && CURRENCY_WORDS[tokens[si - 1].norm] && !consumed.has(si - 1)) { currency = CURRENCY_WORDS[tokens[si - 1].norm]; start = si - 1; }
      for (let k = sj; k < Math.min(sj + 2, tokens.length) && !currency; k++) {
        if (CURRENCY_WORDS[tokens[k].norm]) { currency = CURRENCY_WORDS[tokens[k].norm]; end = k + 1; }
      }
      const loneHundred = words.length === 1 && HUNDRED_WORDS.has(words[0]) && currency === undefined;
      // Money needs something that says so: a currency, or a fee/salary/payment cue nearby. Bare digits ("2010"), spoken scale words
      // ("vela", "lakshalu" in "thousands of people"), years and 8+ digit runs are never turned into rupees on their own.
      const yearLike = ev.value >= 1900 && ev.value <= 2100 && Number.isInteger(ev.value) && (words.length === 1 || ev.hasScale);
      const nearTime = (sj < tokens.length && TIME_WORDS.has(tokens[sj].norm)) || (si > 0 && TIME_WORDS.has(tokens[si - 1].norm));
      let cue = false;
      for (let k = Math.max(0, si - 10); k < Math.min(tokens.length, sj + 10); k++) if ((k < si || k >= sj) && (FEE_WORDS.has(tokens[k].norm) || SALARY_WORDS.has(tokens[k].norm) || MONEY_CUES.has(tokens[k].norm))) { cue = true; break; }
      const longDigits = words.some(t => /^\d{8,}$/.test(t));
      const cued = cue && !longDigits && !(yearLike && nearTime) && (ev.hasScale || (ev.hasDigit && ev.value >= 100));
      const isMoney = !loneHundred && (currency !== undefined || cued);
      const nextIsHour = sj < tokens.length && HOUR_WORDS.has(tokens[sj].norm);
      if (isMoney && !nextIsHour) {
        const value: MoneyValue = { amount: ev.value, currency };
        const surface = tokens.slice(start, end).map(t => t.raw).join(' ');
        const text = formatMoney(value);
        out.push({ type: 'money', start, end, text, surface, value, layer: 'L2-money', changed: surface.replace(/\s/g, '') !== text.replace(/\s/g, '') });
      }
    }
    i = Math.max(runEnd, i + 1);
  }
  return out;
}

/** Every number in the text as a value, whether spoken in words or written in digits, with no money or cue logic. For evaluation. */
export function numberValues(tokens: Token[]): number[] {
  const out: number[] = []; let i = 0;
  while (i < tokens.length) {
    if (!startsNumber(tokens[i].norm)) { i++; continue; }
    let j = i;
    while (j < tokens.length && classifyNum(tokens[j].norm) && !(classifyNum(tokens[j].norm)!.k === 'and' && !(j + 1 < tokens.length && classifyNum(tokens[j + 1].norm)))) j++;
    while (j > i && tokens[j - 1].norm === 'and') j--;
    const words = tokens.slice(i, j).map(t => t.norm);
    for (const [a, b] of segmentNumberRun(words)) {
      const ev = evaluateNumberRun(words.slice(a, b)); if (!ev) continue;
      if (ev.value >= 10) out.push(ev.value);   // 1-9 are too ambiguous in words (oka = a / one) to compare fairly
    }
    i = Math.max(j, i + 1);
  }
  return out;
}

function startsNumber(t: string): boolean {
  const n = classifyNum(t);
  return !!n && n.k !== 'and' && n.k !== 'half';
}

// ---------------------------------------------------------------- hours
export function findHours(tokens: Token[], consumed: Set<number>): Entity[] {
  const out: Entity[] = [];
  for (let k = 1; k < tokens.length; k++) {
    if (!HOUR_WORDS.has(tokens[k].norm) || consumed.has(k - 1)) continue;
    let s = k - 1;
    while (s - 1 >= 0 && classifyNum(tokens[s - 1].norm) && !consumed.has(s - 1)) s--;
    const ev = evaluateNumberRun(tokens.slice(s, k).map(t => t.norm));
    if (!ev || ev.value <= 0 || ev.value > 24) continue;
    out.push({ type: 'hours', start: s, end: k + 1, text: `${ev.value} hours`, surface: tokens.slice(s, k + 1).map(t => t.raw).join(' '), value: ev.value, layer: 'L2-hours', changed: false });
  }
  return out;
}
