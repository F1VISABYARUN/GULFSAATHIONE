// Saathi Exit Path: a rules engine, not a language model. It never invents a fact: every figure it speaks comes from
// server/data/exit_rules.json with a source and a status, and unconfirmed facts are not spoken at all.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tokenize } from '../harness/tokens.ts';
import { evaluateNumberRun } from '../harness/numbers.ts';

const here = dirname(fileURLToPath(import.meta.url));
const rules = JSON.parse(readFileSync(join(here, '..', 'data', 'exit_rules.json'), 'utf8'));
const missions: { country: string; name: string; phone: string }[] = JSON.parse(readFileSync(join(here, '..', 'data', 'missions.json'), 'utf8'));

export type Visa = 'visit' | 'work' | 'residence' | 'unknown';
export interface ExitInput {
  country?: string; visaType?: string; expiry?: string; passportHeld?: string; problem?: string; intent?: string;
  danger?: boolean; today?: Date; overstayedHint?: boolean;
}
export interface Step { te: string; fact?: string; status?: string; source?: string; say?: boolean }
export interface ExitPlan {
  status: 'ask' | 'plan' | 'escalate';
  sayTe: string;
  ask?: { slot: string; te: string };
  country?: string; visa?: Visa; expiryISO?: string; daysLeft?: number; readBack?: string;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  steps: Step[];
  parts?: string[];   // what to say, in short pieces: one or two at a time, then wait
  line?: { name: string; number: string; hours?: string };
  flags: string[];
  never: string[];
}

// ---------------------------------------------------------------- parsing
export function countryOf(text: string): string | undefined {
  const t = ` ${text.toLowerCase()} `;
  const n = ` ${tokenize(text).map(x => x.norm).join(' ')} `;
  for (const [name, c] of Object.entries<any>(rules.countries)) {
    if (c.aliases.some((a: string) => t.includes(` ${a} `) || t.includes(a) && a.length > 4) || c.aliases.some((a: string) => n.includes(` ${a} `))) return name;
  }
  if (/ysdee|saudee|saudi|సౌదీ/.test(n + t)) return 'Saudi Arabia';
  if (/yooeee|yuaee|duba|dubaay|abu ?dhabi|sharj/.test(n)) return 'UAE';
  if (/kuvait/.test(n)) return 'Kuwait'; if (/khataar|qatar/.test(n)) return 'Qatar'; if (/bahrey|bahrain/.test(n)) return 'Bahrain'; if (/oman|muscat|maskat/.test(n)) return 'Oman';
  return undefined;
}
export function visaOf(text: string): Visa {
  const n = ` ${tokenize(text).map(x => x.norm).join(' ')} `;
  if (/(visit|tourist|tourism|vijit|tooristu|toorist|vizit)/.test(n)) return 'visit';
  if (/(work|employment|iqama|ikaama|ikama|residence|resident|rejidens|vark|work visa)/.test(n)) return /(residence|resident|rejidens|iqama|ikaam|ikama)/.test(n) ? 'residence' : 'work';
  return 'unknown';
}
const MONTHS: [RegExp, number][] = [[/^(jan|janavari)/, 1], [/^(feb|phibr|febr)/, 2], [/^(mar|maarch)/, 3], [/^(apr|epril)/, 4], [/^(may|me)$/, 5], [/^(jun|joon)/, 6], [/^(jul|joolai)/, 7], [/^(aug|aagast)/, 8], [/^(sep|septembar)/, 9], [/^(oct|aktobar)/, 10], [/^(nov|navambar)/, 11], [/^(dec|disembar)/, 12]];
const DAY_WORDS = new Set(['rojulu', 'rojula', 'rojullo', 'roju', 'days', 'day', 'din', 'dinon']);
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
export function parseExpiry(text: string, today: Date): Date | undefined {
  const t0 = text.trim(); if (!t0) return undefined;
  const iso = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t0); if (iso) return valid(utc(+iso[1], +iso[2], +iso[3]), +iso[2], +iso[3]);
  const dmy = /(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/.exec(t0); if (dmy) { const y = +dmy[3] < 100 ? 2000 + +dmy[3] : +dmy[3]; return valid(utc(y, +dmy[2], +dmy[1]), +dmy[2], +dmy[1]); }
  const toks = tokenize(t0).map(t => t.norm);
  // "in 5 days" / "ఐదు రోజులు": a number right before a day word
  const di = toks.findIndex(w => DAY_WORDS.has(w));
  if (di > 0) {
    let s = di; while (s - 1 >= 0 && /^\d+$|^[a-z]+$/.test(toks[s - 1]) && evaluateNumberRun([toks[s - 1], ...toks.slice(s, di)]) !== undefined) s--;
    const ev = evaluateNumberRun(toks.slice(s, di)) ?? (/^\d+$/.test(toks[di - 1]) ? { value: Number(toks[di - 1]) } : undefined);
    const single: Record<string, number> = { okati: 1, rendu: 2, moodu: 3, naalugu: 4, aidu: 5, aaru: 6, edu: 7, enimidi: 8, tommidi: 9, padi: 10, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
    const v = ev?.value ?? single[toks[di - 1]];
    if (v !== undefined && v >= 0 && v <= 400) return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + v));
  }
  // "12 December 2026" / "డిసెంబర్ 12"
  for (let i = 0; i < toks.length; i++) {
    const m = MONTHS.find(([re]) => re.test(toks[i])); if (!m) continue;
    const near = [toks[i - 1], toks[i + 1], toks[i - 2], toks[i + 2]].filter(x => x && /^\d+$/.test(x)).map(Number);
    const day = near.find(n => n >= 1 && n <= 31); if (!day) continue;
    const year = near.find(n => n >= 2024 && n <= 2100);
    let d = utc(year ?? today.getUTCFullYear(), m[1], day);
    if (!year && d.getTime() < today.getTime() - 86400000 * 60) d = utc(today.getUTCFullYear() + 1, m[1], day);
    return valid(d, m[1], day);
  }
  return undefined;
}
function valid(d: Date, m: number, day: number) { return d.getUTCMonth() + 1 === m && d.getUTCDate() === day ? d : undefined; }
const iso = (d: Date) => d.toISOString().slice(0, 10);
/** Digits read back one at a time, day then month then year, so the worker can hear a wrong date. */
export function readBackDate(d: Date): string {
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${[...p(d.getUTCDate())].join(' ')}, ${[...p(d.getUTCMonth() + 1)].join(' ')}, ${[...p(d.getUTCFullYear(), 4)].join(' ')}`;
}
export const daysBetween = (from: Date, to: Date) => Math.round((Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()) - Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())) / 86400000);

// ---------------------------------------------------------------- the plan
const NEVER: string[] = rules.never;
const answered = (s?: string) => !!s && !/^(unknown|\s*)$/i.test(s.trim());
const yes = (s?: string) => /^(yes|y|avunu|ఉంది|అవును|true|have|with me)/i.test((s ?? '').trim());
const no = (s?: string) => /^(no|n|ledu|లేదు|false|taken|not)/i.test((s ?? '').trim());
const nn = (n: number) => n.toLocaleString('en-IN');

function lineFor(country: string): ExitPlan['line'] | undefined {
  const c = rules.countries[country];
  if (c?.embassy_line) return { name: c.embassy_line.name, number: c.embassy_line.number, hours: c.embassy_line.hours };
  const m = missions.find(x => x.country === country);
  return m ? { name: m.name, number: m.phone, hours: undefined } : undefined;
}

/** Spoken Telugu for the hours text in the data file. Unknown wording is left out rather than guessed. */
function hoursTe(h?: string) { if (!h) return ''; const x = h.toLowerCase(); const parts = []; if (/24x7|24-hour/.test(x)) parts.push('రోజంతా అందుబాటులో ఉంటుంది'); if (/distress only/.test(x)) parts.push('అత్యవసరం కోసం మాత్రమే'); if (/inside the uae|within uae/.test(x)) parts.push('యూఏఈ లోపల నుండి'); return parts.length ? ', ' + parts.join(', ') : ''; }

export function planExit(inp: ExitInput): ExitPlan {
  const today = inp.today ?? new Date();
  const flags: string[] = [];
  const country = inp.country && rules.countries[inp.country] ? inp.country : undefined;
  const line = country ? lineFor(country) : undefined;
  const mk = (p: Omit<ExitPlan, 'never' | 'flags'> & { flags?: string[] }): ExitPlan => ({ ...p, flags: [...new Set([...flags, ...(p.flags ?? [])])], never: NEVER });

  if (inp.danger) {
    return mk({ status: 'escalate', urgency: 'critical', country, steps: [], line,
      sayTe: `మీరు ఒంటరి కాదు. ఇప్పుడే మా మనిషి మీకు కాల్ చేస్తారు.${line ? ` మీరు వెంటనే రాయబార కార్యాలయం లైన్ ${line.number} కి కూడా కాల్ చేయవచ్చు.` : ''} మీరు ఉన్న దగ్గర కనిపించే షాప్ లేదా బిల్డింగ్ పేరు చెప్పండి.` });
  }

  // questions, in order: country, visa, expiry, passport, problem, intent
  const visa: Visa = (['visit', 'work', 'residence'] as const).find(v => v === inp.visaType) ?? (answered(inp.visaType) ? visaOf(inp.visaType!) : 'unknown');
  const expiry = answered(inp.expiry) ? parseExpiry(inp.expiry!, today) : undefined;
  const ask = (slot: string, te: string): ExitPlan => mk({ status: 'ask', urgency: 'medium', sayTe: te, ask: { slot, te }, steps: [], country, visa: visa === 'unknown' ? undefined : visa, line });
  if (!country) return ask('country', 'మీరు ఇప్పుడు ఏ దేశంలో ఉన్నారు?');
  if (visa === 'unknown') return ask('visa_type', 'మీ వీసా ఏ రకం? విజిట్ లేదా టూరిస్ట్ వీసానా, వర్క్ వీసానా?');
  if (!answered(inp.expiry) || !expiry) {
    if (answered(inp.expiry) && !expiry) flags.push('expiry_not_understood');
    return ask('expiry', answered(inp.expiry) ? 'తేదీ సరిగ్గా అర్థం కాలేదు. మీ వీసా ఏ రోజు వరకు ఉందో, రోజు నెల సంవత్సరం చెప్పండి.' : 'మీ వీసా ఏ తేదీ వరకు ఉంది? రోజు, నెల, సంవత్సరం చెప్పండి.');
  }
  const daysLeft = daysBetween(today, expiry);
  const readBack = readBackDate(expiry);
  if (!answered(inp.passportHeld)) return mk({ ...base(), status: 'ask', urgency: 'medium', sayTe: `మీ వీసా గడువు తేదీ ${readBack} అని విన్నాను, సరైనదేనా? ఇప్పుడు చెప్పండి: మీ పాస్‌పోర్ట్ మీ దగ్గరే ఉందా?`, ask: { slot: 'passport', te: 'మీ పాస్‌పోర్ట్ మీ దగ్గరే ఉందా?' } });
  if (!answered(inp.problem)) return mk({ ...base(), status: 'ask', urgency: 'medium', sayTe: 'ఇప్పుడు మీకు ఏం సమస్య ఉంది? ఉదాహరణకు జీతం, పాస్‌పోర్ట్, ఉండే చోటు, భయం.', ask: { slot: 'problem', te: 'ఇప్పుడు మీకు ఏం సమస్య ఉంది?' } });
  if (!answered(inp.intent)) return mk({ ...base(), status: 'ask', urgency: 'medium', sayTe: 'మీరు ఇండియాకు తిరిగి రావాలనుకుంటున్నారా, లేక ఇక్కడే ఉండాలనుకుంటున్నారా?', ask: { slot: 'intent', te: 'ఇండియాకు తిరిగి రావాలా, ఇక్కడే ఉండాలా?' } });
  function base() { return { country, visa, expiryISO: iso(expiry!), daysLeft, readBack, steps: [] as Step[], line }; }

  // ---- the plan
  const steps: Step[] = [];
  const C = rules.countries[country];
  const home = /(home|india|vellipo|tirigi|return|తిరిగి|ఇండియా|ఇంటికి)/i.test(`${inp.intent} ${tokenize(inp.intent ?? '').map(t => t.norm).join(' ')}`);
  const passportGone = no(inp.passportHeld);
  const st: { urgency: ExitPlan['urgency'] } = { urgency: 'low' };
  const bump = () => { st.urgency = st.urgency === 'low' ? 'medium' : st.urgency; };
  const disclaimer = 'ఇది అధికారిక వెబ్‌సైట్ ప్రకారం; మార్పులు ఉండవచ్చు, రాయబార కార్యాలయంతో నిర్ధారించుకోండి.';

  if (visa === 'visit') {
    const vv = C.visit_visa;
    if (country === 'UAE') {
      const f = vv.overstay_fine_per_day, ex = vv.extension, dp = vv.departure_permit;
      if (daysLeft >= 0) {
        st.urgency = daysLeft <= 7 ? 'high' : 'medium';
        steps.push({ te: `మీ వీసా ఇంకా ${daysLeft} రోజులు ఉంది. గడువు ముగిసిన తర్వాత ప్రతి రోజుకు ${f.amount} దిర్హమ్స్ జరిమానా పడుతుంది.`, fact: 'uae.overstay_fine_per_day', status: f.status, source: f.source });
        steps.push({ te: `పొడిగింపు కోసం అప్లికేషన్ ఫీజు ${ex.application_fee} దిర్హమ్స్, వీసా పొడిగింపు ఫీజు ${ex.entry_fee} దిర్హమ్స్. మొత్తం ఉండే రోజులు ${ex.max_total_days} దాటకూడదు. ఎవరు అప్లై చేయాలి అనే వివరం నేను చెప్పలేను; దానికి రాయబార కార్యాలయం లైన్ అడగండి.`, fact: 'uae.extension', status: ex.status, source: ex.source });
        steps.push({ te: 'గడువు ముగియక ముందే నిర్ణయం తీసుకోండి: పొడిగించుకోండి లేదా తిరిగి వెళ్ళడానికి టికెట్ చూసుకోండి.', say: false });
      } else {
        const over = -daysLeft; st.urgency = 'high'; flags.push('overstayed');
        steps.push({ te: `మీ వీసా గడువు ${over} రోజుల క్రితం ముగిసింది. రోజుకు ${f.amount} దిర్హమ్స్ చొప్పున సుమారు ${nn(over * f.amount)} దిర్హమ్స్ జరిమానా అవుతుంది (అంచనా మాత్రమే).`, fact: 'uae.overstay_fine_per_day', status: f.status, source: f.source });
        steps.push({ te: `తిరిగి వెళ్ళాలంటే డిపార్చర్ పర్మిట్ కావాలి: అప్లికేషన్ ${dp.application_fee} దిర్హమ్స్ మరియు సర్వీస్ ఫీజు ${dp.service_fee} దిర్హమ్స్. పర్మిట్ వచ్చిన ${dp.leave_within_days} రోజుల్లో దేశం వదిలి వెళ్ళాలి, అందుకు ఆ తేదీలోపు టికెట్ ఉండాలి. జరిమానాలు ముందు కట్టాలి.`, fact: 'uae.departure_permit', status: dp.status, source: dp.source });
      }
    } else if (country === 'Saudi Arabia') {
      const p = vv.overstay_penalty; st.urgency = daysLeft <= 7 ? 'high' : 'medium';
      if (daysLeft < 0) { st.urgency = 'high'; flags.push('overstayed'); }
      steps.push({ te: `సౌదీ అంతర్గత మంత్రిత్వ శాఖ ప్రకటన ప్రకారం గడువు దాటి ఉంటే ${nn(p.fine_up_to)} రియాల్స్ వరకు జరిమానా, జైలు, దేశ బహిష్కరణ ఉండవచ్చు. ఖచ్చితమైన మొత్తం నేను చెప్పలేను.`, fact: 'sa.overstay_penalty', status: p.status, source: p.source });
      steps.push({ te: daysLeft >= 0 ? `మీ వీసా ఇంకా ${daysLeft} రోజులు ఉంది. గడువు ముగియక ముందే ఏం చేయాలో రాయబార కార్యాలయం లైన్‌ని అడగండి.` : 'గడువు దాటింది కాబట్టి ఇప్పుడే రాయబార కార్యాలయం లైన్‌కి కాల్ చేయండి; మా మనిషి కూడా మీ కేసు చూస్తారు.' });
    } else {
      st.urgency = daysLeft <= 7 ? 'high' : 'medium';
      steps.push({ te: `మీ వీసా ${daysLeft >= 0 ? `ఇంకా ${daysLeft} రోజులు ఉంది` : 'గడువు ముగిసింది'}. ఈ దేశానికి నా దగ్గర ధృవీకరించిన జరిమానా వివరాలు లేవు, కాబట్టి అంకెలు చెప్పను. రాయబార కార్యాలయం సహాయం తీసుకోండి.` });
    }
    flags.push('visit_visa');
  } else {
    steps.push({ te: 'మీ వీసా రకం వల్ల ఏం చేయాలో ఈ దేశానికి నా దగ్గర ధృవీకరించిన సమాచారం లేదు. మా మనిషి మీ కేసు చూస్తారు.' });
    st.urgency = 'medium';
  }

  if (passportGone) {
    flags.push('passport_not_with_worker'); bump();
    if (country === 'UAE') {
      const np = C.no_passport, lab = C.labour;
      steps.push({ te: `పాస్‌పోర్ట్ మీ దగ్గర లేకపోతే ఇండియాకు తిరిగి రావడానికి ఎమర్జెన్సీ సర్టిఫికేట్ ఇస్తారు. ఫీజు ${np.emergency_certificate_fee} దిర్హమ్స్. కావాల్సినవి: అప్లికేషన్ ఫారం, మూడు ఫోటోలు, పాత పాస్‌పోర్ట్ వివరాలు లేదా వేరే ఫోటో ID.`, fact: 'uae.emergency_certificate', status: np.status, source: np.source });
      steps.push({ te: `మీ పాస్‌పోర్ట్ యజమాని దగ్గర ఉంటే: యూఏఈ అధికారిక సూచన ప్రకారం చాలా మంది కార్మికుల పాస్‌పోర్ట్ తీసుకోవడం నిషేధం, కానీ ఇంట్లో పని చేసేవారికి నియమం వేరు. మానవ వనరుల శాఖ ఫిర్యాదు లైన్ ${lab.complaint_line}.`, fact: 'uae.labour', status: lab.status, source: lab.source, say: false });
    } else {
      steps.push({ te: 'పాస్‌పోర్ట్ లేకుండా తిరిగి రావడానికి రాయబార కార్యాలయం సహాయం చేస్తుంది. వివరాల కోసం వారి లైన్‌కి కాల్ చేయండి; మా మనిషి మీ కేసు నమోదు చేస్తారు.' });
    }
  }
  if (home) steps.push({ te: 'తిరిగి వెళ్ళే తేదీ లేదా ఖర్చు గురించి నేను హామీ ఇవ్వలేను. రాయబార కార్యాలయం మరియు మా మనిషి మీకు తదుపరి అడుగు చెబుతారు.', say: false });
  if (answered(inp.problem) && /(salary|jeetam|jeetham|జీతం|unpaid|తిండి|food|room|beat|కొట్ట|threat|బెదిరి)/i.test(`${inp.problem} ${tokenize(inp.problem ?? '').map(t => t.norm).join(' ')}`)) { flags.push('welfare_problem'); bump(); }
  if (line) steps.push({ te: `సహాయం కోసం భారత రాయబార కార్యాలయం లైన్ నంబర్ ${line.number}${hoursTe(line.hours)}.` });

  const parts = steps.filter(s => s.say !== false).map(s => s.te);
  if (steps.some(s => s.status === 'confirmed')) parts.push(disclaimer);
  return { ...mk({ status: 'plan', urgency: st.urgency, country, visa, expiryISO: iso(expiry), daysLeft, readBack, steps, line, flags, sayTe: parts.join(' ') }), parts };
}
