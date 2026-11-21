// Telugu-script lexicon. Entries are written in Telugu (as STT outputs them) and converted
// with toLatin() at load, so they always match transliterated transcripts.
// Words here come from real Saathi test calls (eval/bolna). VERIFY with a native speaker.

import { toLatin } from './translit.ts';
import {
  UNIT_WORDS, HUNDRED_WORDS, MULTIPLIER_WORDS, CURRENCY_WORDS, DIGIT_WORDS, PHONE_TENS, REPEAT_WORDS,
  GULF_TERMS, DISTRESS_PHRASES, CORRECTION_MARKERS, SALARY_WORDS, FEE_WORDS, HOUR_WORDS, JOB_WORDS, STOPWORDS,
  type DistressKind,
} from './lexicon.ts';

const L = (s: string) => toLatin(s).toLowerCase();
const words = (s: string) => L(s).split(/\s+/).filter(Boolean);

// ---- numbers (Telugu words + English number words spoken and written in Telugu script)
const units: [string[], number][] = [
  [['సున్నా', 'జీరో'], 0], [['ఒకటి', 'ఒక', 'ఒక్క', 'వన్'], 1], [['రెండు', 'టూ'], 2], [['మూడు', 'త్రీ'], 3],
  [['నాలుగు', 'ఫోర్'], 4], [['ఐదు', 'అయిదు', 'ఫైవ్'], 5], [['ఆరు', 'సిక్స్'], 6], [['ఏడు', 'సెవెన్'], 7],
  [['ఎనిమిది', 'ఎయిట్'], 8], [['తొమ్మిది', 'నైన్'], 9], [['పది', 'టెన్'], 10], [['పదకొండు'], 11],
  [['పన్నెండు'], 12], [['పదమూడు'], 13], [['పద్నాలుగు'], 14], [['పదిహేను', 'పదిహేనూ'], 15], [['పదహారు'], 16],
  [['పదిహేడు'], 17], [['పద్దెనిమిది'], 18], [['పంతొమ్మిది'], 19], [['ఇరవై', 'ట్వంటీ'], 20],
  [['ముప్పై', 'ముప్ఫై', 'థర్టీ'], 30], [['నలభై', 'ఫార్టీ'], 40], [['యాభై', 'ఏభై', 'ఫిఫ్టీ'], 50],
  [['అరవై', 'సిక్స్టీ'], 60], [['డెబ్బై', 'సెవెంటీ'], 70], [['ఎనభై', 'ఎయిటీ'], 80], [['తొంభై', 'నైంటీ'], 90],
];
for (const [ws, v] of units) for (const w of ws) if (!UNIT_WORDS.has(L(w))) UNIT_WORDS.set(L(w), v);
for (const w of ['వంద', 'వందలు', 'వందల', 'నూరు', 'హండ్రెడ్']) HUNDRED_WORDS.add(L(w));
for (const [ws, v] of [
  [['వెయ్యి', 'వేయి', 'వేలు', 'వేల', 'థౌజండ్'], 1_000],
  [['లక్ష', 'లక్షలు', 'లక్షల', 'లక్షా', 'లాక్', 'లాఖ్'], 100_000],
  [['కోటి', 'కోట్లు', 'కోట్ల'], 10_000_000],
] as [string[], number][]) for (const w of ws) MULTIPLIER_WORDS.set(L(w), v);
for (const w of ['రూపాయలు', 'రూపాయిలు', 'రూపాయి', 'రూపాయల', 'రూ']) CURRENCY_WORDS[L(w)] = 'INR';
for (const w of ['దిర్హామ్స్', 'దిర్హమ్స్', 'దిర్హామ్', 'దిర్హమ్']) CURRENCY_WORDS[L(w)] = 'AED';
for (const w of ['రియాల్స్', 'రియాల్', 'రియాలు']) CURRENCY_WORDS[L(w)] = 'SAR';

// phone digits (single digits only; "double/triple" too)
for (const [ws, v] of units.filter(([, v]) => v <= 9)) for (const w of ws) if (L(w) !== 'oka') DIGIT_WORDS.set(L(w), v);
for (const [w, v] of [['ట్వంటీ', 2], ['థర్టీ', 3], ['ఫార్టీ', 4], ['ఫిఫ్టీ', 5], ['సిక్స్టీ', 6], ['సెవెంటీ', 7], ['ఎయిటీ', 8], ['నైంటీ', 9]] as [string, number][]) PHONE_TENS.set(L(w), v);
for (const w of ['డబల్', 'డబుల్']) REPEAT_WORDS.set(L(w), 2);
for (const w of ['ట్రిపుల్', 'త్రిబుల్']) REPEAT_WORDS.set(L(w), 3);

// ---- cue words
for (const w of ['జీతం', 'జీతము', 'శాలరీ', 'సాలరీ', 'నెలకు', 'పైసలు', 'వేతనం']) SALARY_WORDS.add(L(w));
for (const w of ['ఫీజు', 'ఫీ', 'కట్టాను', 'కట్టాలి', 'కట్టా', 'ఇచ్చాను', 'ఇచ్చిన', 'ఇచ్చినాము', 'ఇచ్చినారు', 'ఇచ్చాము',
  'అడిగారు', 'అడిగాడు', 'అడిగింది', 'అడిగిండు', 'అడుగుతున్నాడు', 'ఇవ్వమన్నాడు', 'తీసుకుని', 'తీసుకొని', 'ఏజెంట్', 'అడ్వాన్స్']) FEE_WORDS.add(L(w));
for (const w of ['గంటలు', 'గంటల', 'గంట', 'అవర్స్']) HOUR_WORDS.add(L(w));
for (const [w, job] of [
  ['క్లీనింగ్', 'cleaner'], ['క్లీనర్', 'cleaner'], ['డ్రైవర్', 'driver'], ['డ్రైవింగ్', 'driver'], ['హెల్పర్', 'helper'],
  ['వంట', 'cook'], ['కుక్', 'cook'], ['మేకలు', 'shepherd'], ['గొర్రెలు', 'shepherd'], ['గొర్రె', 'shepherd'],
  ['పశువులతోని', 'farm worker'], ['పశువులు', 'farm worker'], ['పంట', 'farm worker'], ['ఫామ్', 'farm worker'],
  ['ఒంటెలు', 'camel herder'], ['మేస్త్రీ', 'mason'], ['సెక్యూరిటీ', 'security guard'],
] as [string, string][]) JOB_WORDS[L(w)] = job;
for (const w of ['నా', 'నేను', 'మీరు', 'మీ', 'అన్న', 'అండి', 'గారు', 'కి', 'లో', 'నుండి', 'అని', 'ఉంది', 'లేదు', 'కాదు', 'ఏజెంట్',
  'పేరు', 'వీసా', 'అవును', 'సరే', 'ఇప్పుడు', 'ఏం', 'ఏమి', 'చెప్పండి', 'తెలుగు', 'తెలియదు', 'ఆ', 'ఈ', 'వాళ్ళు', 'ఆయన',
  'ఇక్కడ', 'అక్కడ', 'మా', 'నాకు', 'నన్ను', 'హలో', 'ఓకే', 'ఇంటి']) STOPWORDS.add(L(w));

// ---- self-correction markers
CORRECTION_MARKERS.unshift(words('కాదు కాదు'), words('లేదు లేదు'));
CORRECTION_MARKERS.push(words('కాదు'), words('సారీ'));

// ---- Gulf terms in Telugu script + mishearings seen in real calls
const gulfTe: Record<string, { v: string[]; asr?: string[] }> = {
  kafeel: { v: ['కఫీల్', 'కఫిల్', 'స్పాన్సర్'] },
  iqama: { v: ['ఇకామా', 'ఇఖామా', 'ఇకమా'] },
  huroob: { v: ['హురూబ్', 'హురుబ్'] },
  arbab: { v: ['అర్బాబ్', 'అర్బాబు'], asr: ['arabat', 'అరబాట్'] },
  visit_visa: {
    v: ['విజిట్ వీసా', 'విజిట్ వీజా', 'టూరిస్ట్ వీసా', 'టూరిస్ట్ వీజా', 'సందర్శక వీసా', 'సందర్శక వీజా', 'సందర్శన వీసా', 'విజిట్లో', 'టూరిస్ట్'],
    asr: ['విజిట్ విజయ్', 'విజిట్ విజయ', 'visit vijay', 'visit vijaya', 'టూరిస్ట్ విజయ్'],
  },
  work_visa: { v: ['వర్క్ వీసా', 'వర్క్ వీజా', 'ఉద్యోగ వీసా', 'ఎంప్లాయ్మెంట్ వీసా', 'వర్క్ పర్మిట్'] },
  final_exit: { v: ['ఫైనల్ ఎగ్జిట్'] },
};
for (const t of GULF_TERMS) {
  const add = gulfTe[t.id];
  if (!add) continue;
  t.variants.push(...add.v.map(L));
  t.asr = [...(t.asr ?? []), ...(add.asr ?? []).map(L)];
}

// ---- distress / risk phrases (Telugu script, from real calls)
const distressTe: Partial<Record<DistressKind, string[]>> = {
  violence: ['కొడుతున్నారు', 'కొడుతున్నాడు', 'కొట్టారు', 'కొట్టాడు', 'కొడతారు'],
  threat: ['చంపేస్తారు', 'చంపుతారు', 'చంపేస్తాడు'],
  help: ['కాపాడండి', 'కాపాడు', 'సహాయం చేయండి', 'హెల్ప్ చేయండి', 'సహాయం కావాలి', 'నన్ను ఇండియా పంపించండి'],
  deprivation: ['తిండి పెట్టడం లేదు', 'తిండి పెట్టలేదు', 'తిండి లేదు', 'నీళ్ళు ఇవ్వడం లేదు', 'అన్నం పెట్టడం లేదు'],
  confinement: ['కిడ్నాప్', 'కిడ్నాప్ చేశారు', 'రూమ్లో పెట్టారు', 'రూమ్ లో పెట్టారు', 'ఒక రూమ్లో', 'బయటకు పోనివ్వడం లేదు'],
  passport_held: ['పాస్పోర్ట్ తీసుకున్నారు', 'పాస్పోర్ట్ తీసుకున్నాడు', 'పాస్‌పోర్ట్ తీసుకున్నారు', 'పాస్పోర్ట్ ఇవ్వలేదు', 'పాస్పోర్ట్ ఇవ్వరు',
    'పాస్పోర్ట్ లేదు', 'passport ledu', 'పాస్పోర్ట్ పోయింది'],
  salary_unpaid: ['జీతం రాలేదు', 'జీతం ఇవ్వలేదు', 'జీతం ఇవ్వడం లేదు', 'పైసలు ఇవ్వడం లేదు', 'పైసలు ఇవ్వలేదు', 'పైసలు ఇయ్యటం లేదు',
    'jeetam raaledandi', 'jeetam raaledu', 'salary raaledu'],
};
for (const g of DISTRESS_PHRASES) g.phrases.push(...(distressTe[g.kind] ?? []).map(L));
// New signal: taken from the airport by someone other than the employer (Goat Life pattern)
DISTRESS_PHRASES.push({
  kind: 'taken_by_stranger', te: 'vere vaallu teesukellaaru',
  phrases: ['వేరే వాళ్ళు తీసుకెళ్లారు', 'వేరే వాళ్ళు తీసుకెళ్ళారు', 'వేరే వాళ్ళు వచ్చి తీసుకెళ్లారు', 'వేరే వాళ్ళు తీసుకెళ్తున్నాడు',
    'వేరే అతను తీసుకెళ్తున్నాడు', 'ఒకతను వచ్చి తీసుకెళ్ళిండు', 'కొత్త వాళ్ళు తీసుకెళ్లారు', 'వేరే కంపెనీ వాళ్ళు', 'వేరే వాళ్ళు తీసుకు',
    'వేరే వాళ్ళు పిలిచి', 'వేరే వాళ్ళు తీసుకుని పోయారు', 'లేదు వేరే వాళ్ళు',
    'vere vallu teesukellaru', 'vere vaallu teesukellaaru', 'other people took me', 'someone else picked me up'].map(L),
});

DISTRESS_PHRASES.push({
  kind: 'cheated', te: 'agent mosam chesadu',
  phrases: ['మోసం చేసిండు', 'మోసం చేశాడు', 'మోసం చేసాడు', 'మోసం చేసిండ్రు', 'మోసం చేశారు', 'మోసం చేసి', 'మోసం వేసిందా',
    'mosam chesadu', 'mosam chesindu', 'cheated me', 'dhokha diya', 'धोखा दिया'].map(L),
});

// ---- places in Telugu script -> canonical name (used by the phonetic matcher as aliases)
export const PLACE_ALIASES: Record<string, string> = Object.fromEntries(([
  ['జగిత్యాల', 'Jagtial'], ['జగిత్యాల్', 'Jagtial'], ['జగిత్యాలయ', 'Jagtial'], ['Jagityala', 'Jagtial'], ['Jagityal', 'Jagtial'],
  ['కరీంనగర్', 'Karimnagar'], ['నిజామాబాద్', 'Nizamabad'], ['నిజాంబాద్', 'Nizamabad'], ['సిరిసిల్ల', 'Sircilla'],
  ['కోరుట్ల', 'Korutla'], ['మెట్పల్లి', 'Metpally'], ['కొడిమ్యాల', 'Kodimial'], ['ఆర్మూర్', 'Armoor'], ['కామారెడ్డి', 'Kamareddy'],
  ['హైదరాబాద్', 'Hyderabad'], ['శంషాబాద్', 'Shamshabad'],
  ['దుబాయ్', 'Dubai'], ['దుబాయి', 'Dubai'], ['దేరా', 'Deira'], ['షార్జా', 'Sharjah'], ['అబుదాబి', 'Abu Dhabi'],
  ['ఓమన్', 'Oman'], ['ఒమన్', 'Oman'], ['ఒమాన్', 'Oman'], ['మస్కట్', 'Muscat'],
  ['ఖతర్', 'Qatar'], ['కతార్', 'Qatar'], ['కతర్', 'Qatar'], ['ఖతార్', 'Qatar'], ['దోహా', 'Doha'],
  ['సౌదీ', 'Saudi'], ['రియాద్', 'Riyadh'], ['జెద్దా', 'Jeddah'], ['దమ్మామ్', 'Dammam'],
  ['కువైట్', 'Kuwait'], ['బహ్రెయిన్', 'Bahrain'],
] as [string, string][]).map(([a, c]) => [L(a), c]));

export const GULF_COUNTRY: Record<string, string> = {
  Dubai: 'UAE', Deira: 'UAE', 'Abu Dhabi': 'UAE', Sharjah: 'UAE', Ajman: 'UAE', 'Ras Al Khaimah': 'UAE', Fujairah: 'UAE',
  Riyadh: 'Saudi Arabia', Jeddah: 'Saudi Arabia', Dammam: 'Saudi Arabia', 'Al Khobar': 'Saudi Arabia', Jubail: 'Saudi Arabia', Saudi: 'Saudi Arabia',
  Muscat: 'Oman', Salalah: 'Oman', Oman: 'Oman', Doha: 'Qatar', Qatar: 'Qatar', Kuwait: 'Kuwait', Manama: 'Bahrain', Bahrain: 'Bahrain',
};
export const TELANGANA_DISTRICTS = new Set(['Jagtial', 'Karimnagar', 'Sircilla', 'Rajanna Sircilla', 'Nizamabad', 'Kamareddy', 'Nirmal',
  'Adilabad', 'Mancherial', 'Peddapalli', 'Medak', 'Siddipet', 'Warangal', 'Hyderabad']);
