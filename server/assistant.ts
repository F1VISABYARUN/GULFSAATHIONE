// Saathi call-in assistant: the "broker who knows everything", for a worker on any phone.
// One utterance in (Telugu / Hindi / English, from any STT) -> intent -> answer in Telugu + actions.
//
// Rules from our design notes:
//  - Safety first: the deterministic gate runs before anything else; danger always escalates to a human.
//  - Never guess a location. Use what he says (landmark, road, bus number) and say when we cannot know.
//  - Speaking Arabic on his behalf only for short, confirmed messages; legal/police matters go to a human.
//  - Live search needs GOOGLE_MAPS_API_KEY; without it we say so instead of inventing places.

import { runHarness, ALL_ON } from './harness/index.ts';
import { tokenize } from './harness/tokens.ts';
import { gateDecision } from './live.ts';
import { buildCaseFile } from './casefile.ts';
import { loadHelplines } from './casefile.ts';
import type { CallContext } from './harness/types.ts';

export type Intent = 'emergency' | 'find_place' | 'directions' | 'bus_route' | 'speak_for_me' | 'complaint' | 'helpline' | 'unknown';

const has = (norms: string[], words: string[]) => words.some(w => norms.some(n => n === w || n.startsWith(w)));

/** Rule-based intent on transliterated tokens (works on Telugu script too). */
export function detectIntent(text: string): Intent {
  const n = tokenize(text).map(t => t.norm);
  const j = n.join(' ');
  if (has(n, ['complaint', 'phiryaadu', 'firyadu', 'case', 'report'])) return 'complaint';
  if (/(arabic|arabi|matladu|maatlaadu|cheppu|chepandi|cheppandi|baat kar).*(atanitho|aayanatho|vaallatho|unnatho|this person|ee manishi|tho)|(talk|speak) (to|with) (him|her|this person)|on my behalf|naa taraphuna|naa badulu/.test(j)) return 'speak_for_me';
  if (has(n, ['bassu', 'bus', 'bas']) && /(ekkadiki|ekkada|where|kahan|velthundi|veltundi|potundi|pothundi|jaati)/.test(j)) return 'bus_route';
  if (/(ela vellali|ela velli|how (do i|to) (go|get)|route|darii|daari|directions|kaise jaun)/.test(j)) return 'directions';
  if (has(n, ['hotal', 'hotel', 'restaurant', 'tindi', 'food', 'khana', 'annam', 'bojanam', 'bhojanam', 'masjid', 'temple', 'gudi', 'hospital', 'aaspatri', 'asupatri', 'bus', 'station', 'steshan', 'stesan', 'embassy', 'consulate', 'police', 'polees', 'atm', 'pharmacy'])) return 'find_place';
  if (has(n, ['helpline', 'number', 'nambar', 'embasi'])) return 'helpline';
  return 'unknown';
}

// ---- place kinds the worker asks for
const PLACE_QUERIES: [RegExp, string, string][] = [
  [/(indian|telugu|andhra|bhojanam|bojanam|annam|tindi|khana|food|hotal|hotel|restaurant)/, 'Indian restaurant', 'Indian hotel / bhojanam'],
  [/(hospital|aaspatri|asupatri|clinic|doctor)/, 'hospital', 'hospital'],
  [/(bus\s*station|bassu\s*steshan|bus stand|metro)/, 'bus station', 'bus station'],
  [/(embassy|embasi|consulate|kaansulet)/, 'Embassy of India', 'Indian embassy / consulate'],
  [/(police|polees)/, 'police station', 'police station'],
  [/(masjid|mosque)/, 'mosque', 'mosque'],
  [/(temple|gudi|mandir)/, 'Hindu temple', 'temple'],
  [/(pharmacy|medical shop|mandula)/, 'pharmacy', 'pharmacy'],
  [/(atm|bank)/, 'ATM', 'ATM'],
];

/** Where is he? Only from what he said: a known place name or a phrase after "near / daggara / దగ్గర". */
export function extractAnchor(text: string): { anchor?: string; city?: string } {
  const h = runHarness(text, {}, ALL_ON);
  const city = h.slots.places?.find(p => /dubai|deira|sharjah|abu dhabi|ajman|riyadh|jeddah|dammam|muscat|doha|kuwait|manama|bahrain|oman|qatar/i.test(p));
  const norms = tokenize(text);
  const iNear = norms.findIndex(t => ['daggara', 'daggar', 'near', 'paas', 'pakkana', 'mundu', 'opposite', 'lo'].includes(t.norm));
  let anchor: string | undefined;
  if (iNear >= 0 && norms[iNear].norm === 'near') {
    anchor = /\bnear\s+([^,;?!]+)/i.exec(text)?.[1]?.trim();
  } else if (iNear > 0) {
    const before = norms.slice(Math.max(0, iNear - 3), iNear).filter(t => !/^(nenu|naa|ikkada|unnanu|main|i|am)$/.test(t.norm));
    if (before.length) anchor = before.map(t => t.norm.replace(/(loni|lo|ki)$/, '')).join(' ');
  }
  const landmark = /(burj\s*khal(?:ifa)?|bruj\s*khal(?:ifa)?|dubai mall|gold souk|clock tower|batha|baths|kaaba|corniche|mall of the emirates)/.exec(norms.map(t => t.norm).join(' '));
  if (landmark) anchor = landmark[0].replace(/bruj/, 'burj');
  return { anchor, city };
}

// ---- Arabic phrases for "speak for me" (short, factual). VERIFY with a native Arabic speaker.
export const ARABIC_SCRIPTS: Record<string, { te: string; ar: string; en: string }> = {
  no_arabic: { te: 'నాకు అరబిక్ రాదు', ar: 'أنا لا أتكلم العربية. هذا مساعد هاتفي يترجم لي.', en: 'I do not speak Arabic. This is a phone assistant translating for me.' },
  need_food: { te: 'నాకు తిండి కావాలి', ar: 'أنا جائع وأحتاج إلى طعام وماء، من فضلك.', en: 'I am hungry and need food and water, please.' },
  need_help: { te: 'నాకు సహాయం కావాలి', ar: 'أحتاج إلى مساعدة. من فضلك اتصل بالسفارة الهندية.', en: 'I need help. Please call the Indian Embassy.' },
  want_embassy: { te: 'ఇండియన్ ఎంబసీతో మాట్లాడాలి', ar: 'أريد التحدث مع السفارة الهندية.', en: 'I want to speak to the Indian Embassy.' },
  salary_unpaid: { te: 'నా జీతం ఇవ్వలేదు', ar: 'لم أستلم راتبي.', en: 'I have not received my salary.' },
  passport: { te: 'నా పాస్‌పోర్ట్ తిరిగి ఇవ్వండి', ar: 'من فضلك أعد لي جواز سفري.', en: 'Please give my passport back to me.' },
  hospital: { te: 'నన్ను హాస్పిటల్‌కి తీసుకెళ్ళండి', ar: 'من فضلك خذني إلى المستشفى.', en: 'Please take me to the hospital.' },
  where_bus: { te: 'ఈ బస్సు ఎక్కడికి వెళ్తుంది?', ar: 'إلى أين تذهب هذه الحافلة؟', en: 'Where does this bus go?' },
};

function pickScript(text: string): string[] {
  const j = tokenize(text).map(t => t.norm).join(' ');
  const out = ['no_arabic'];
  if (/(tindi|annam|food|khana|aakali|akali|neellu)/.test(j)) out.push('need_food');
  if (/(jeetam|jeetham|salary|paisalu)/.test(j)) out.push('salary_unpaid');
  if (/(paasport|passport)/.test(j)) out.push('passport');
  if (/(hospital|aaspatri|debba|noppi)/.test(j)) out.push('hospital');
  if (/(embassy|embasi)/.test(j)) out.push('want_embassy');
  if (/(bassu|bus)/.test(j)) out.push('where_bus');
  if (out.length === 1 || /(sahaayam|sahayam|help|kaapaadandi|kapadandi)/.test(j)) out.push('need_help');
  return [...new Set(out)];
}

// ---- live search (Google Maps Platform). Without a key we say so instead of inventing places.
export async function mapsFetch(url: string, init?: RequestInit) {
  try { return await fetch(url, {...init,signal:AbortSignal.timeout(6000)}); } catch { return undefined; }
}
async function placesSearch(query: string): Promise<{ name: string; address?: string; open?: boolean }[] | undefined> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return undefined;
  const r = await mapsFetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.currentOpeningHours.openNow' },
    body: JSON.stringify({ textQuery: query, maxResultCount: 3 }),
  });
  if (!r?.ok) return undefined;
  const d = await r.json().catch(() => null);
  if (!d) return undefined;
  return (d.places ?? []).map((p: any) => ({ name: p.displayName?.text, address: p.formattedAddress, open: p.currentOpeningHours?.openNow }));
}

async function transitDirections(origin: string, destination: string): Promise<string[] | undefined> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return undefined;
  const u = `https://maps.googleapis.com/maps/api/directions/json?mode=transit&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&key=${key}`;
  const r = await mapsFetch(u);
  if (!r?.ok) return undefined;
  const d = await r.json().catch(() => null);
  if (!d) return undefined;
  if (!['OK','ZERO_RESULTS'].includes(d.status)) return undefined;
  const steps = d.routes?.[0]?.legs?.[0]?.steps ?? [];
  return steps.slice(0, 6).map((s: any) => s.transit_details
    ? `Bus/metro ${s.transit_details.line?.short_name ?? s.transit_details.line?.name ?? ''} from ${s.transit_details.departure_stop?.name} to ${s.transit_details.arrival_stop?.name} (${s.transit_details.num_stops} stops)`
    : String(s.html_instructions ?? '').replace(/<[^>]+>/g, ''));
}

export interface AssistantReply {
  intent: Intent;
  sayTe: string;                 // what the voice agent says back (Telugu)
  escalate: boolean;
  needs?: string;                // what we still need from him
  data?: unknown;
  speakForMe?: { key: string; te: string; ar: string; en: string }[];
  caseFileId?: string;
  liveSearch: 'used' | 'not_configured' | 'not_needed';
}

export async function assist(text: string, ctx: CallContext = {}): Promise<AssistantReply> {
  // 1) safety first
  const gate = gateDecision([{ text }], ctx);
  if (gate.action === 'ESCALATE') {
    const contacts = loadHelplines().filter(h => h.status === 'official' && /toll|24/i.test(h.kind ?? '')).slice(0, 3);
    return { intent: 'emergency', escalate: true, sayTe: gate.sayTe!, data: { risks: gate.risks, contacts }, liveSearch: 'not_needed' };
  }

  const intent = detectIntent(text);
  const { anchor, city } = extractAnchor(text);
  const where = [anchor, city].filter(Boolean).join(', ');

  if (intent === 'find_place') {
    const j = tokenize(text).map(t => t.norm).join(' ');
    const kind = PLACE_QUERIES.find(([re]) => re.test(j)) ?? PLACE_QUERIES[0];
    if (!where) return { intent, escalate: false, needs: 'location', sayTe: 'మీరు ఇప్పుడు ఎక్కడ ఉన్నారు? దగ్గరలో కనిపించే పెద్ద బిల్డింగ్, షాప్, మసీదు లేదా రోడ్డు పేరు చెప్పండి.', liveSearch: 'not_needed' };
    const places = await placesSearch(`${kind[1]} near ${where}`);
    if (!places) return { intent, escalate: false, data: { query: `${kind[1]} near ${where}` }, sayTe: `${where} దగ్గర ${kind[2]} వెతకాలి — కానీ లైవ్ సెర్చ్ ఇప్పుడు అందుబాటులో లేదు.`, liveSearch: 'not_configured' };
    if (!places.length) return { intent, escalate: false, sayTe: `${where} దగ్గర ${kind[2]} దొరకలేదు. ఇంకో దగ్గర గుర్తు చెప్పండి.`, liveSearch: 'used' };
    const top = places.slice(0, 2).map(p => `${p.name}${p.address ? ', ' + p.address : ''}`).join('; ');
    return { intent, escalate: false, data: places, sayTe: `${where} దగ్గర: ${top}. ఎవరినైనా ఈ పేరు చూపించి అడగండి, లేదా దారి కావాలంటే చెప్పండి.`, liveSearch: 'used' };
  }

  if (intent === 'directions' || intent === 'bus_route') {
    const dest = /(ki|ku|to)\s+(\S+(?:\s+\S+)?)/.exec(tokenize(text).map(t => t.norm).join(' '))?.[2];
    if (!where) return { intent, escalate: false, needs: 'location', sayTe: 'మీరు ఇప్పుడు ఏ రోడ్డు మీద / ఏ స్టాప్ దగ్గర ఉన్నారు? బస్సు మీద నంబర్ ఉంటే అది కూడా చెప్పండి.', liveSearch: 'not_needed' };
    if (intent === 'bus_route') {
      const busNo = /\b([a-z]?\d{1,3}[a-z]?)\b/i.exec(text)?.[1];
      if (!busNo) return { intent, escalate: false, needs: 'bus_number', sayTe: 'బస్సు ముందు లేదా పక్కన రాసి ఉన్న నంబర్ చెప్పండి. నంబర్ లేకుండా అది ఎక్కడికి వెళ్తుందో నేను ఖచ్చితంగా చెప్పలేను.', data: { speakForMe: ARABIC_SCRIPTS.where_bus }, liveSearch: 'not_needed' };
      const places = await placesSearch(`bus route ${busNo} ${city ?? ''}`.trim());
      if (!places) return { intent, escalate: false, data: { busNo, speakForMe: ARABIC_SCRIPTS.where_bus }, sayTe: `బస్సు ${busNo} రూట్ చూడాలి — లైవ్ సెర్చ్ అందుబాటులో లేదు. డ్రైవర్‌కి ఈ మాట వినిపించమంటారా: "ఈ బస్సు ఎక్కడికి వెళ్తుంది?"`, liveSearch: 'not_configured' };
      return { intent, escalate: false, data: { busNo, places }, sayTe: `బస్సు ${busNo}: ${places.map(p => p.name).join('; ') || 'వివరాలు దొరకలేదు'}. ఖచ్చితంగా తెలియాలంటే డ్రైవర్‌ని అడగమంటారా?`, liveSearch: 'used' };
    }
    if (!dest) return { intent, escalate: false, needs: 'destination', sayTe: 'మీరు ఎక్కడికి వెళ్ళాలి?', liveSearch: 'not_needed' };
    const steps = await transitDirections(where, dest);
    if (!steps) return { intent, escalate: false, data: { origin: where, destination: dest }, sayTe: `${where} నుండి ${dest} కి దారి చూడాలి — లైవ్ సెర్చ్ అందుబాటులో లేదు.`, liveSearch: 'not_configured' };
    return { intent, escalate: false, data: steps, sayTe: steps.length ? `దారి: ${steps.join('. ')}.` : 'దారి దొరకలేదు. ఇంకో గుర్తు చెప్పండి.', liveSearch: 'used' };
  }

  if (intent === 'speak_for_me') {
    const lines = pickScript(text).map(k => ({ key: k, ...ARABIC_SCRIPTS[k] }));
    return {
      intent, escalate: false, speakForMe: lines,
      sayTe: `అవతల వ్యక్తికి అరబిక్‌లో ఇది చెప్తాను: ${lines.map(l => l.te).join(', ')}. సరేనా? "సరే" అంటే ఫోన్ వాళ్లకి ఇవ్వండి. పోలీసు లేదా కేసు విషయం అయితే మా మనిషి మాట్లాడతారు.`,
      liveSearch: 'not_needed',
    };
  }

  if (intent === 'complaint') {
    const cf = buildCaseFile([{ text, kind: 'call-in' }], ctx);
    return { intent, escalate: cf.escalate, caseFileId: cf.id, data: { risks: cf.risks.map(r => r.id), actions: cf.actions.map(a => a.who) }, sayTe: `మీ ఫిర్యాదు నమోదు చేశాను, నంబర్ ${cf.id}. మా మనిషి దీన్ని చూసి మీకు కాల్ చేస్తారు. ఇంకా ఏమైనా చెప్పాలా?`, liveSearch: 'not_needed' };
  }

  if (intent === 'helpline') {
    const h = runHarness(text, ctx, ALL_ON);
    const country = h.slots.country;
    const contacts = loadHelplines().filter(x => x.status === 'official' && (!country || (x.country ?? '').toLowerCase().includes(country.toLowerCase().split(' ')[0]))).slice(0, 3);
    return { intent, escalate: false, data: contacts, sayTe: contacts.length ? `ఈ నంబర్లు: ${contacts.map(c => c.value).join('; ')}.` : 'మీరు ఏ దేశంలో ఉన్నారు? ఆ దేశం ఎంబసీ నంబర్ చెప్తాను.', liveSearch: 'not_needed' };
  }

  return { intent: 'unknown', escalate: false, sayTe: 'చెప్పండి — మీకు ఏం కావాలి? తిండి, దారి, బస్సు, ఎవరితోనైనా అరబిక్‌లో మాట్లాడాలా, లేదా ఫిర్యాదు?', liveSearch: 'not_needed' };
}
