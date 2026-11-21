// Turn locked entities + text into the structured case slots the risk engine reads.

import type { Token } from './tokens.ts';
import type { Entity, CaseSlots } from './types.ts';
import { SALARY_WORDS, FEE_WORDS, STOPWORDS } from './lexicon.ts';
import type { MoneyValue, PhoneValue } from './numbers.ts';
import { GULF_COUNTRY, TELANGANA_DISTRICTS } from './lexicon.te.ts';
import { MANDAL_DISTRICTS, DISTRICT_NAMES, districtOf } from './gazetteer.ts';

const SURNAMES = new Set(['reddy', 'goud', 'gowda', 'rao', 'yadav', 'naidu', 'chary', 'babu', 'khan', 'ahmed', 'kumar', 'shetty', 'patel', 'singh']);
const POSITIVE_PAID = new Set(['ichhadu', 'ichadu', 'ichaadu', 'ichharu', 'icharu', 'ichindi', 'vachindi', 'paid', 'mili', 'diya', 'padindi', 'credited', 'vesaru', 'vesadu']);
const NEGATIVE_SUFFIX = /(ledu|ledhu|ledandi|ledhandi|ledani|aledu|atledu|tledu|nahi|nahin|not|never|ivvaledu|raledu)$/;

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
    if (e.type === 'gulf' && e.value === 'work_visa' && slots.visaType !== 'visit') slots.visaType = 'work'; // risk-conservative: any live "visit visa" wins
    if (e.type === 'gulf' && e.value === 'huroob') slots.huroob = true;
    if (e.type === 'gulf' && e.value === 'mafi_fulus') slots.salaryPaid = false;
    if (e.type === 'passportType') slots.passportType = e.value === 'ecr' ? 'ECR' : 'ECNR';
    if (e.type === 'hours') slots.hoursPerDay = e.value as number;
    if (e.type === 'job' && !negatedAfter(tokens, e.end)) slots.job = e.text; // "driver pani ledu" = NOT driver
  }

  // ---- distress + passport + salary polarity
  const distress = live.filter(e => e.type === 'distress');
  if (distress.some(d => d.value === 'passport_held')) slots.passportHeld = true;
  if (distress.some(d => d.value === 'salary_unpaid')) slots.salaryPaid = false;
  if (distress.some(d => d.value === 'taken_by_stranger')) slots.takenByStranger = true;
  if (distress.some(d => d.value === 'code_phrase')) slots.codePhrase = true;
  const kinds = [...new Set(distress.map(d => String(d.value)).filter(k => k !== 'passport_held' && k !== 'salary_unpaid' && k !== 'taken_by_stranger' && k !== 'code_phrase'))];
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
    while (k < tokens.length && ['peru', 'name', 'is', 'naam', 'sub', 'ane', 'garu', 'perentandi', 'perenti'].includes(tokens[k].norm)) k++;
    if (k >= tokens.length) return undefined;
    const ent = nameAt(k);
    if (ent) return ent.text;
    // never take a word that another layer already locked (e.g. "who rub" = huroob, an amount, a place)
    if (live.some(e => e.type !== 'name' && e.start <= k && k < e.end) || entities.some(e => e.type === 'gulf' && e.start <= k && k < e.end)) return undefined;
    const t = tokens[k];
    if (STOPWORDS.has(t.norm) || /\d/.test(t.norm) || t.norm.length < 3 || VERB_LIKE.test(t.norm)) return undefined;
    let name = cap(t.norm);
    if (k + 1 < tokens.length && SURNAMES.has(tokens[k + 1].norm)) name += ' ' + cap(tokens[k + 1].norm);
    return name;
  };
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i].norm;
    if (AGENT_WORDS.has(t) && !slots.agentName) slots.agentName = personAfter(i + 1);
    if (EMPLOYER_WORDS.has(t) && !slots.employerName) {
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
  const country = [...places].reverse().find(p => GULF_COUNTRY[p]);
  if (country) slots.country = GULF_COUNTRY[country];
  const district = places.find(p => TELANGANA_DISTRICTS.has(p) || DISTRICT_NAMES.has(p));
  if (district) slots.district = district;
  const mandal = places.find(p => MANDAL_DISTRICTS.has(p) && !DISTRICT_NAMES.has(p));
  if (mandal) {
    slots.mandal = mandal;
    if (!slots.district) slots.district = districtOf(mandal).district;
  }
  return slots;
}

const AGENT_WORDS = new Set(['agent', 'ejent', 'ejant', 'edyun']);
const EMPLOYER_WORDS = new Set(['kafeel', 'arbab', 'employer', 'company', 'kampenee', 'spaansar', 'sponsor', 'yajamaani', 'onar', 'owner']);
const VERB_LIKE = /(ledu|ledhu|adu|aru|indi|anu|amu|undi|unnadu|aledu|tunnadu|tunnaru|chesadu|cheppadu)$/;
const NEG = new Set(['ledu', 'ledhu', 'kadu', 'kaadu', 'nahi', 'not', 'no', 'ivvaledu', 'raledu']);
function negatedAfter(tokens: Token[], end: number): boolean {
  return tokens.slice(end, end + 2).some(t => NEG.has(t.norm));
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
