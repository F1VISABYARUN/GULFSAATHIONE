// Turn locked entities + text into the structured case slots the risk engine reads.

import type { Token } from './tokens.ts';
import type { Entity, CaseSlots } from './types.ts';
import { SALARY_WORDS, FEE_WORDS, STOPWORDS } from './lexicon.ts';
import type { MoneyValue, PhoneValue } from './numbers.ts';

const SURNAMES = new Set(['reddy', 'goud', 'gowda', 'rao', 'yadav', 'naidu', 'chary', 'babu', 'khan', 'ahmed', 'kumar', 'shetty', 'patel', 'singh']);
const POSITIVE_PAID = new Set(['ichhadu', 'ichadu', 'ichaadu', 'ichharu', 'icharu', 'ichindi', 'vachindi', 'paid', 'mili', 'diya', 'padindi', 'credited', 'vesaru', 'vesadu']);
const NEGATIVE_SUFFIX = /(ledu|ledhu|aledu|atledu|tledu|ledu|nahi|nahin|not|never|ivvaledu|raledu)$/;

export function extractSlots(tokens: Token[], entities: Entity[]): CaseSlots {
  const live = entities.filter(e => !e.superseded).sort((a, b) => a.start - b.start);
  const slots: CaseSlots = {};

  // ---- money: fee vs salary by nearest cue word
  for (const e of live.filter(e => e.type === 'money')) {
    const v = e.value as MoneyValue;
    const kind = moneyKind(tokens, e, v);
    if (kind === 'salary') slots.salary = { amount: v.amount, currency: v.currency };
    else if (kind === 'fee' && (!v.currency || v.currency === 'INR')) slots.feeINR = v.amount;
  }

  // ---- visa / passport / gulf signals
  for (const e of live) {
    if (e.type === 'gulf' && e.value === 'visit_visa') slots.visaType = 'visit';
    if (e.type === 'gulf' && e.value === 'work_visa') slots.visaType = 'work';
    if (e.type === 'gulf' && e.value === 'huroob') slots.huroob = true;
    if (e.type === 'gulf' && e.value === 'mafi_fulus') slots.salaryPaid = false;
    if (e.type === 'passportType') slots.passportType = e.value === 'ecr' ? 'ECR' : 'ECNR';
    if (e.type === 'hours') slots.hoursPerDay = e.value as number;
    if (e.type === 'job') slots.job = e.text;
  }

  // ---- distress + passport + salary polarity
  const distress = live.filter(e => e.type === 'distress');
  if (distress.some(d => d.value === 'passport_held')) slots.passportHeld = true;
  if (distress.some(d => d.value === 'salary_unpaid')) slots.salaryPaid = false;
  const kinds = [...new Set(distress.map(d => String(d.value)).filter(k => k !== 'passport_held' && k !== 'salary_unpaid'))];
  if (kinds.length) slots.distress = kinds;
  if (slots.salaryPaid === undefined) {
    for (let i = 0; i < tokens.length; i++) {
      if (!SALARY_WORDS.has(tokens[i].norm)) continue;
      const win = tokens.slice(i + 1, i + 5).map(t => t.norm);
      if (win.some(w => NEGATIVE_SUFFIX.test(w))) { slots.salaryPaid = false; break; }
      if (win.some(w => POSITIVE_PAID.has(w))) { slots.salaryPaid = true; }
    }
  }

  // ---- people
  const nameAt = (i: number) => live.find(e => e.type === 'name' && e.start === i);
  const personAfter = (i: number): string | undefined => {
    let k = i;
    while (k < tokens.length && ['peru', 'name', 'is', 'naam', 'sub', 'ane', 'garu'].includes(tokens[k].norm)) k++;
    if (k >= tokens.length) return undefined;
    const ent = nameAt(k);
    if (ent) return ent.text;
    const t = tokens[k];
    if (STOPWORDS.has(t.norm) || /\d/.test(t.norm) || t.norm.length < 3) return undefined;
    let name = cap(t.raw);
    if (k + 1 < tokens.length && SURNAMES.has(tokens[k + 1].norm)) name += ' ' + cap(tokens[k + 1].raw);
    return name;
  };
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i].norm;
    if (t === 'agent' && !slots.agentName) slots.agentName = personAfter(i + 1);
    if ((t === 'kafeel' || t === 'arbab' || t === 'employer' || t === 'company') && !slots.employerName) {
      const who = personAfter(i + 1);
      if (who && !['peru', 'daggara'].includes(who.toLowerCase())) slots.employerName = who;
    }
  }
  // "atani peru Saleem" / "his name is Saleem" at the airport -> pickup person
  const text = tokens.map(t => t.norm).join(' ');
  if (/airport|pick|teesukellaru|tisukellaru|teesukelladu|tisukelladu|vachadu/.test(text)) {
    for (let i = 0; i < tokens.length - 1; i++) {
      const prev = tokens[i - 1]?.norm;
      if ((tokens[i].norm === 'peru' || (tokens[i].norm === 'name' && tokens[i + 1]?.norm === 'is')) && !['naa', 'my', 'mera', 'na'].includes(prev ?? '')) {
        const who = personAfter(i);
        if (who) { slots.pickupName = who; break; }
      }
    }
  }

  const phones = live.filter(e => e.type === 'phone').map(e => e.text);
  if (phones.length) slots.phones = phones;
  const places = [...new Set(live.filter(e => e.type === 'place').map(e => e.text))];
  if (places.length) slots.places = places;
  return slots;
}

function moneyKind(tokens: Token[], e: Entity, v: MoneyValue): 'fee' | 'salary' | undefined {
  let best: { kind: 'fee' | 'salary'; d: number } | undefined;
  for (let k = Math.max(0, e.start - 6); k < Math.min(tokens.length, e.end + 6); k++) {
    if (k >= e.start && k < e.end) continue;
    const d = k < e.start ? e.start - k : k - e.end + 1;
    const n = tokens[k].norm;
    const kind = SALARY_WORDS.has(n) ? 'salary' : FEE_WORDS.has(n) ? 'fee' : undefined;
    if (kind && (!best || d < best.d)) best = { kind, d };
  }
  if (best) return best.kind;
  if (v.currency && v.currency !== 'INR') return 'salary';
  return undefined;
}

function cap(s: string): string {
  const w = s.replace(/[^\p{L}]/gu, '');
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

export type { PhoneValue };
