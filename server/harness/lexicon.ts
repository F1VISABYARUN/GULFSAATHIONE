// Indian + Gulf lexicon used by the deterministic harness layers.
// Romanized Telugu spellings vary a lot; add variants you hear in real recordings.
// Items marked VERIFY should be checked by a native speaker / official source.

const map = (pairs: [string[], number][]) => {
  const m = new Map<string, number>();
  for (const [words, v] of pairs) for (const w of words) m.set(w, v);
  return m;
};

// ---- Numbers -------------------------------------------------------------
export const UNIT_WORDS = map([
  // English
  [['zero'], 0], [['one'], 1], [['two'], 2], [['three'], 3], [['four'], 4], [['five'], 5],
  [['six'], 6], [['seven'], 7], [['eight'], 8], [['nine'], 9], [['ten'], 10], [['eleven'], 11],
  [['twelve'], 12], [['thirteen'], 13], [['fourteen'], 14], [['fifteen'], 15], [['sixteen'], 16],
  [['seventeen'], 17], [['eighteen'], 18], [['nineteen'], 19], [['twenty'], 20], [['thirty'], 30],
  [['forty', 'fourty'], 40], [['fifty'], 50], [['sixty'], 60], [['seventy'], 70], [['eighty'], 80],
  [['ninety'], 90],
  // Telugu
  [['sunna'], 0], [['okati', 'oka', 'okka', 'okate'], 1], [['rendu', 'rondu'], 2], [['moodu', 'mudu'], 3],
  [['nalugu', 'naalugu'], 4], [['aidu', 'ayidu', 'ayudu'], 5], [['aaru'], 6], [['edu', 'yedu'], 7],
  [['enimidi', 'enmidi', 'yenimidi'], 8], [['tommidi', 'thommidi'], 9], [['padi', 'padhi'], 10],
  [['padakondu'], 11], [['pannendu'], 12], [['padamoodu'], 13], [['padnalugu'], 14], [['padihenu'], 15],
  [['padaharu'], 16], [['padihedu'], 17], [['paddenimidi'], 18], [['pantommidi'], 19],
  [['iravai', 'iruvai', 'iravy'], 20], [['muppai', 'muppy', 'muppay'], 30],
  [['nalabhai', 'nalabai', 'nalubhai', 'nalabay'], 40], [['yaabhai', 'yabhai', 'yaabai', 'yabai', 'yabhay', 'yaabhay'], 50],
  [['aravai', 'aruvai'], 60], [['debbai', 'debhai'], 70], [['enabhai', 'enabai', 'yenabhai'], 80],
  [['tombhai', 'thombhai', 'tombai'], 90],
  // Hindi
  [['ek'], 1], [['do'], 2], [['teen'], 3], [['char', 'chaar'], 4], [['paanch', 'panch'], 5],
  [['chhe', 'chhah', 'che'], 6], [['saat'], 7], [['aath'], 8], [['nau'], 9], [['das'], 10],
  [['gyarah'], 11], [['barah'], 12], [['pandrah'], 15], [['bees'], 20], [['pachees', 'pachchees'], 25],
  [['tees'], 30], [['chalees', 'chalis'], 40], [['pachaas', 'pachas'], 50], [['saath'], 60],
  [['sattar'], 70], [['assi'], 80], [['nabbe'], 90],
]);

export const HUNDRED_WORDS = new Set(['hundred', 'sau', 'vanda', 'vandala', 'vandalu', 'vandha', 'nooru']);

export const MULTIPLIER_WORDS = map([
  [['thousand', 'thousands', 'hazaar', 'hazar', 'hajar', 'veyyi', 'veyi', 'velu', 'vela', 'vel'], 1_000],
  [['lakh', 'lakhs', 'lac', 'lacs', 'laksha', 'lakshalu', 'lakshala', 'lakha', 'lakshlu'], 100_000],
  [['crore', 'crores', 'karod', 'karor', 'koti', 'kotlu', 'kotla'], 10_000_000],
]);

/** Words that are themselves a fractional quantity: "dedh lakh" = 1.5 lakh. */
export const FRACTION_WORDS = map([
  [['dedh', 'dhed'], 1.5], [['dhai', 'dhaai', 'dhaee', 'adhai'], 2.5], [['ara', 'arra'], 0.5],
]);

/** Modifiers applied to the next number: "sava do lakh" = 2.25 lakh. */
export const MODIFIER_WORDS = map([
  [['sava', 'savva'], 0.25], [['saade', 'sade', 'saadhe'], 0.5], [['paune', 'pone'], -0.25],
]);

export const CURRENCY_WORDS: Record<string, 'INR' | 'AED' | 'SAR' | 'QAR' | 'OMR' | 'KWD'> = {
  rs: 'INR', rupees: 'INR', rupee: 'INR', inr: 'INR', rupaye: 'INR', rupaiye: 'INR', rupay: 'INR',
  rupayalu: 'INR', rupailu: 'INR', rupaayalu: 'INR', rupaalu: 'INR',
  dirham: 'AED', dirhams: 'AED', dirhamlu: 'AED', aed: 'AED', dhs: 'AED',
  riyal: 'SAR', riyals: 'SAR', riyalu: 'SAR', sar: 'SAR', rial: 'SAR', rials: 'SAR',
  qar: 'QAR', omr: 'OMR', kwd: 'KWD', dinar: 'KWD', dinars: 'KWD',
};

// ---- Phone digits --------------------------------------------------------
export const DIGIT_WORDS = map([
  [['zero', 'oh', 'sunna', 'shunya', 'shoonya'], 0],
  [['one', 'okati', 'ek'], 1], [['two', 'rendu', 'do'], 2], [['three', 'moodu', 'mudu', 'teen'], 3],
  [['four', 'nalugu', 'naalugu', 'char', 'chaar'], 4], [['five', 'aidu', 'ayidu', 'paanch', 'panch'], 5],
  [['six', 'aaru', 'chhe'], 6], [['seven', 'edu', 'yedu', 'saat'], 7],
  [['eight', 'enimidi', 'enmidi', 'aath'], 8], [['nine', 'tommidi', 'thommidi', 'nau'], 9],
]);
export const PHONE_TENS = map([
  [['twenty'], 2], [['thirty'], 3], [['forty', 'fourty'], 4], [['fifty'], 5],
  [['sixty'], 6], [['seventy'], 7], [['eighty'], 8], [['ninety'], 9],
]);
export const REPEAT_WORDS = map([[['double', 'dabal', 'dubble', 'dubbal'], 2], [['triple', 'tripple', 'tribble'], 3]]);
export const FILLERS = new Set(['umm', 'um', 'uh', 'aa', 'ah', 'ante', 'hmm', 'er', 'mm']);

// ---- Gulf Arabic / migration terms ----------------------------------------
export interface GulfTerm {
  id: string;
  canonical: string;
  variants: string[];     // legit romanized spellings (normalized, space separated)
  asr?: string[];         // typical ASR mishearings — only repaired when the harness is on
  meaningEn: string;
  meaningTe: string;
  signal?: 'visit_visa' | 'work_visa' | 'huroob' | 'salary_unpaid' | 'salary_delay';
}

export const GULF_TERMS: GulfTerm[] = [
  { id: 'kafeel', canonical: 'kafeel', variants: ['kafeel', 'kafil', 'kafeal', 'kaffeel', 'cafeel', 'kafel', 'kafiil'], asr: ['ka feel', 'coffee el'],
    meaningEn: 'sponsor (employer who holds your visa)', meaningTe: 'spansar — mee visa unna yajamani' },
  { id: 'iqama', canonical: 'iqama', variants: ['iqama', 'ikama', 'iqaama', 'ikaama', 'akama', 'eqama', 'iqamah'], asr: ['i kama', 'e kama', 'a comma', 'i comma', 'eye comma'],
    meaningEn: 'Saudi residence permit (ID card)', meaningTe: 'Saudi lo residence permit (ID card)' },
  { id: 'huroob', canonical: 'huroob', variants: ['huroob', 'hurub', 'huroub', 'huruub', 'hurroob'], asr: ['huroop', 'hu rub', 'who rub', 'who roob', 'hoo rub'],
    meaningEn: 'absconding report filed by the sponsor — worker becomes "illegal"', meaningTe: 'paaripoyadu ani kafeel pettina case — worker illegal avthadu', signal: 'huroob' },
  { id: 'arbab', canonical: 'arbab', variants: ['arbab', 'arbaab', 'arbob'], asr: ['ar bab', 'our bob', 'ar bob'],
    meaningEn: 'owner / boss', meaningTe: 'yajamani / boss' },
  { id: 'final_exit', canonical: 'final exit', variants: ['final exit', 'final exit visa'], asr: ['finel exit', 'final exist'],
    meaningEn: 'permanent exit visa from Saudi', meaningTe: 'Saudi nundi shaashvatanga vellipoye exit visa' },
  { id: 'exit_reentry', canonical: 'exit re-entry', variants: ['exit reentry', 'exit re entry', 'exit and reentry', 'exit entry'],
    meaningEn: 'leave and come back visa', meaningTe: 'velli malli raavadaniki visa' },
  { id: 'visit_visa', canonical: 'visit visa', variants: ['visit visa', 'visiting visa', 'tourist visa', 'visa visit', 'visit visalo'],
    meaningEn: 'visit/tourist visa — NOT legal for work', meaningTe: 'visit visa — deenitho pani cheyyadam chattaviruddham', signal: 'visit_visa' },
  { id: 'work_visa', canonical: 'work visa', variants: ['work visa', 'employment visa', 'working visa', 'job visa', 'company visa'],
    meaningEn: 'employment visa', meaningTe: 'udyoga visa', signal: 'work_visa' },
  { id: 'mafi_fulus', canonical: 'mafi fulus', variants: ['mafi fulus', 'maafi fulus', 'mafi floos', 'mafee floos', 'mafi pulus', 'maafi floos'],
    meaningEn: '"no money" — salary not paid', meaningTe: '"dabbulu levu" — jeetham ivvaledu', signal: 'salary_unpaid' },
  { id: 'bukra', canonical: 'bukra', variants: ['bukra', 'bokra', 'bukhra'],
    meaningEn: '"tomorrow" — often used to delay salary', meaningTe: '"repu" — jeetham vaayida', signal: 'salary_delay' },
  { id: 'emirates_id', canonical: 'Emirates ID', variants: ['emirates id', 'emirate id'], asr: ['emirates idea'],
    meaningEn: 'UAE residence ID card', meaningTe: 'UAE residence ID card' },
  { id: 'labour_card', canonical: 'labour card', variants: ['labour card', 'labor card'], asr: ['leber card'],
    meaningEn: 'UAE work permit card', meaningTe: 'UAE work permit card' },
  { id: 'ecr', canonical: 'ECR', variants: ['ecr'], meaningEn: 'Emigration Check Required passport', meaningTe: 'ECR passport — emigration clearance kavali' },
  { id: 'ecnr', canonical: 'ECNR', variants: ['ecnr'], meaningEn: 'Emigration Check Not Required passport', meaningTe: 'ECNR passport' },
];

// ---- Places (gazetteer). VERIFY mandal spellings against official lists. --
export const PLACES: string[] = [
  // Telangana districts with high Gulf migration
  'Jagtial', 'Karimnagar', 'Sircilla', 'Rajanna Sircilla', 'Nizamabad', 'Kamareddy', 'Nirmal', 'Adilabad',
  'Mancherial', 'Peddapalli', 'Medak', 'Siddipet', 'Warangal', 'Hyderabad',
  // Jagtial district mandals (VERIFY)
  'Kodimial', 'Korutla', 'Metpally', 'Mallial', 'Dharmapuri', 'Raikal', 'Sarangapur', 'Ibrahimpatnam',
  'Mallapur', 'Kathlapur', 'Medipalli', 'Gollapalli', 'Pegadapalli', 'Velgatoor', 'Buggaram', 'Beerpur', 'Endapally',
  // Sircilla / Nizamabad / Karimnagar (VERIFY)
  'Vemulawada', 'Konaraopeta', 'Yellareddypet', 'Gambhiraopet', 'Mustabad', 'Chandurthi', 'Boinpally',
  'Armoor', 'Balkonda', 'Bheemgal', 'Bodhan', 'Mortad', 'Kammarpally', 'Velpur', 'Nandipet', 'Choppadandi',
  'Gangadhara', 'Ramadugu', 'Huzurabad', 'Shamshabad',
  // Gulf
  'Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Riyadh', 'Jeddah', 'Dammam',
  'Al Khobar', 'Jubail', 'Muscat', 'Salalah', 'Doha', 'Kuwait', 'Manama', 'Bahrain', 'Qatar', 'Oman', 'Saudi',
];

// ---- Meaning guard ---------------------------------------------------------
export const CORRECTION_MARKERS: string[][] = [
  ['kadu', 'kadu'], ['kaadu', 'kaadu'], ['no', 'no'], ['nahi', 'nahi'], ['ledu', 'ledu'],
  ['i', 'mean'], ['kadu'], ['kaadu'], ['kadhu'], ['sorry'], ['actually'], ['matlab'], ['galti'],
  ['correction'], ['wait'], ['ledu'], ['nahi'],
];

export type DistressKind = 'violence' | 'threat' | 'help' | 'deprivation' | 'confinement' | 'passport_held' | 'salary_unpaid';

export const DISTRESS_PHRASES: { kind: DistressKind; phrases: string[]; te: string }[] = [
  { kind: 'violence', te: 'kodutunnaru (himsa)', phrases: ['kodutunnaru', 'kodthunnaru', 'kottaru', 'kottinaru', 'kodtunnadu', 'kottadu', 'beating me', 'beat me', 'hitting me', 'maar rahe', 'maarte hain', 'maara'] },
  { kind: 'threat', te: 'champestharu ani bedirimpu', phrases: ['champestharu', 'champutharu', 'champestanu', 'champesthadu', 'kill me', 'maar denge', 'maar dalenge', 'jaan se maar'] },
  { kind: 'help', te: 'sahayam kosam pilupu', phrases: ['kapadandi', 'kaapadandi', 'kapadu', 'help me', 'save me', 'bachao', 'bachalo', 'help cheyyandi', 'help cheyandi'] },
  { kind: 'deprivation', te: 'annam/neellu ivvatledu', phrases: ['annam pettatledu', 'annam ivvatledu', 'neellu ivvatledu', 'neellu levu', 'tindi ledu', 'tindi pettatledu', 'khana nahi', 'no food', 'no water'] },
  { kind: 'confinement', te: 'bandhincharu', phrases: ['bandhincharu', 'room lo pettaru', 'locked me', 'band kar diya', 'bayataki ponivvatledu'] },
  { kind: 'passport_held', te: 'passport teeskunnaru', phrases: ['passport teeskunnaru', 'passport tisukunnaru', 'passport teesukunnaru', 'passport lakkunnaru', 'passport ivvatledu', 'passport ivvaledu', 'passport kafeel daggara', 'passport arbab daggara', 'passport company daggara', 'took my passport', 'took passport', 'passport le liya', 'passport rakh liya'] },
  { kind: 'salary_unpaid', te: 'jeetham ivvaledu', phrases: ['jeetham ivvaledu', 'jeetham ivvatledu', 'jeetham raledu', 'jeetham ivvadam ledu', 'salary ivvaledu', 'salary ivvatledu', 'salary raledu', 'salary radam ledu', 'salary nahi mili', 'salary nahi diya', 'salary not paid', 'no salary', 'mafi fulus'] },
];

export const SALARY_WORDS = new Set(['salary', 'jeetham', 'jitham', 'jeetam', 'raatib', 'ratib', 'pagar', 'tankha', 'vetanam', 'nelaki', 'monthly', 'month', 'mahina']);
export const FEE_WORDS = new Set(['fee', 'fees', 'kattanu', 'kattamu', 'kattaru', 'ichhanu', 'ichanu', 'icchanu', 'ichamu', 'ichaanu', 'adigadu', 'adigaru', 'adugutunnadu', 'charge', 'charges', 'diya', 'diye', 'liya', 'liye', 'advance', 'commission', 'agent', 'paid', 'pay', 'teeskunnadu', 'tisukunnadu']);
export const HOUR_WORDS = new Set(['hours', 'hour', 'hrs', 'gantalu', 'ganta', 'gantala', 'ghante', 'ghanta']);

export const JOB_WORDS: Record<string, string> = {
  driver: 'driver', helper: 'helper', cleaner: 'cleaner', cleaning: 'cleaner', mason: 'mason', meshtri: 'mason',
  electrician: 'electrician', plumber: 'plumber', cook: 'cook', carpenter: 'carpenter', welder: 'welder',
  painter: 'painter', labour: 'labour', labor: 'labour', security: 'security guard', guard: 'security guard',
  shepherd: 'shepherd', mekalu: 'shepherd', gorrelu: 'shepherd', goats: 'shepherd', goat: 'shepherd', camel: 'camel herder', onte: 'camel herder',
  farm: 'farm worker', masara: 'farm worker', house: 'domestic worker', housemaid: 'domestic worker', 'domestic': 'domestic worker',
};

/** Common Tenglish words that must never be "corrected" into a place/name. */
export const STOPWORDS = new Set([
  'naa', 'nenu', 'meeru', 'mee', 'memu', 'anna', 'akka', 'ki', 'ku', 'lo', 'nundi', 'ani', 'undi', 'unnadu', 'unnaru',
  'ledu', 'kadu', 'the', 'and', 'to', 'from', 'my', 'is', 'was', 'a', 'an', 'in', 'on', 'at', 'of', 'for', 'he', 'she',
  'salary', 'job', 'agent', 'visa', 'passport', 'company', 'peru', 'name', 'sir', 'madam', 'okay', 'ok', 'haan', 'avunu',
  'cheppadu', 'chepparu', 'vachadu', 'vellanu', 'vellali', 'month', 'nelaki', 'emi', 'em', 'enti', 'ippudu', 'appudu',
  'hello', 'please', 'thank', 'thanks', 'call', 'phone', 'number', 'money', 'dabbulu', 'paisa', 'work', 'pani',
  'who', 'what', 'where', 'when', 'his', 'her', 'him', 'they', 'it', 'adi', 'idi', 'emo', 'kuda', 'ayithe', 'kooda', 'vere', 'okaru', 'atanu', 'aame', 'vallu', 'manaki', 'naaku', 'meeku', 'kani', 'inka', 'malli', 'chala', 'baga',
]);
