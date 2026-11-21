// Export the harness lexicon (after Telugu-script augmentation) to JSON for the Python port.
import { writeFileSync } from 'node:fs';
import '../server/harness/lexicon.te.ts';
import * as L from '../server/harness/lexicon.ts';
import { PLACE_ALIASES, GULF_COUNTRY } from '../server/harness/lexicon.te.ts';
const m = (x: Map<string, number>) => Object.fromEntries(x);
const m2 = (x: Map<string, string>) => Object.fromEntries(x);
writeFileSync('python/gulf_saathi_harness/lexicon.json', JSON.stringify({
  units: m(L.UNIT_WORDS), hundred: [...L.HUNDRED_WORDS], mult: m(L.MULTIPLIER_WORDS), frac: m(L.FRACTION_WORDS), mods: m(L.MODIFIER_WORDS),
  currency: L.CURRENCY_WORDS, digits: m(L.DIGIT_WORDS), tens: m(L.PHONE_TENS), repeat: m(L.REPEAT_WORDS), fillers: [...L.FILLERS],
  gulf: L.GULF_TERMS.map(t => ({ id: t.id, canonical: t.canonical, variants: t.variants, asr: t.asr ?? [] })),
  distress: L.DISTRESS_PHRASES.map(d => ({ kind: d.kind, phrases: d.phrases })),
  id_cues: m2(L.ID_CUES), time_words: [...L.TIME_WORDS], money_cues: [...L.MONEY_CUES], salary_words: [...L.SALARY_WORDS], fee_words: [...L.FEE_WORDS], places: L.PLACES, place_aliases: PLACE_ALIASES, gulf_country: GULF_COUNTRY,
}, null, 1));
console.log('exported');
