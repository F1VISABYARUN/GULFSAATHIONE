// Script layer: Telugu (and Devanagari) script -> Roman letters, by rule. No LLM.
//
// Real call transcripts arrive in Telugu script, and Indian STT often drops Telugu speech
// into Devanagari ("ऐं टी" for "enti"). Everything downstream (numbers, Gulf terms, distress,
// names) matches on Roman text, so we convert first. Brahmic scripts are regular:
// consonant + (matra | virama | inherent 'a'). Lexicon entries written in Telugu script are
// converted with this same function, so both sides always agree on spelling.

type Table = {
  vowels: Record<string, string>;
  matras: Record<string, string>;
  consonants: Record<string, string>;
  virama: string;
  anusvara: string[];
  visarga: string;
  nukta?: string;
  nuktaMap?: Record<string, string>;
  digits: string; // the script's 0-9
  dropFinalA: boolean; // Hindi drops the inherent final 'a'; Telugu does not
};

const TELUGU: Table = {
  vowels: { 'అ': 'a', 'ఆ': 'aa', 'ఇ': 'i', 'ఈ': 'ee', 'ఉ': 'u', 'ఊ': 'oo', 'ఋ': 'ru', 'ఎ': 'e', 'ఏ': 'e', 'ఐ': 'ai', 'ఒ': 'o', 'ఓ': 'o', 'ఔ': 'au' },
  matras: { 'ా': 'aa', 'ి': 'i', 'ీ': 'ee', 'ు': 'u', 'ూ': 'oo', 'ృ': 'ru', 'ె': 'e', 'ే': 'e', 'ై': 'ai', 'ొ': 'o', 'ో': 'o', 'ౌ': 'au' },
  consonants: {
    'క': 'k', 'ఖ': 'kh', 'గ': 'g', 'ఘ': 'gh', 'ఙ': 'n', 'చ': 'ch', 'ఛ': 'chh', 'జ': 'j', 'ఝ': 'jh', 'ఞ': 'ny',
    'ట': 't', 'ఠ': 'th', 'డ': 'd', 'ఢ': 'dh', 'ణ': 'n', 'త': 't', 'థ': 'th', 'ద': 'd', 'ధ': 'dh', 'న': 'n',
    'ప': 'p', 'ఫ': 'ph', 'బ': 'b', 'భ': 'bh', 'మ': 'm', 'య': 'y', 'ర': 'r', 'ఱ': 'r', 'ల': 'l', 'ళ': 'l',
    'వ': 'v', 'శ': 'sh', 'ష': 'sh', 'స': 's', 'హ': 'h',
  },
  virama: '్', anusvara: ['ం', 'ఁ'], visarga: 'ః', digits: '౦౧౨౩౪౫౬౭౮౯', dropFinalA: false,
};

const DEVANAGARI: Table = {
  vowels: { 'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo', 'ऋ': 'ri', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'ऑ': 'o', 'ऍ': 'e' },
  matras: { 'ा': 'aa', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo', 'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ॉ': 'o', 'ॅ': 'e' },
  consonants: {
    'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'n', 'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
    'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n', 'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
    'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm', 'य': 'y', 'र': 'r', 'ल': 'l', 'ळ': 'l', 'व': 'v',
    'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
  },
  virama: '्', anusvara: ['ं', 'ँ'], visarga: 'ः', nukta: '़',
  nuktaMap: { 'क': 'q', 'ख': 'kh', 'ग': 'g', 'ज': 'z', 'ड': 'r', 'ढ': 'rh', 'फ': 'f' },
  digits: '०१२३४५६७८९', dropFinalA: true,
};

const LABIALS = new Set(['p', 'ph', 'b', 'bh', 'm', 'v']);

function tableFor(ch: string): Table | undefined {
  const c = ch.codePointAt(0)!;
  if (c >= 0x0C00 && c <= 0x0C7F) return TELUGU;
  if (c >= 0x0900 && c <= 0x097F) return DEVANAGARI;
  return undefined;
}

export function hasIndicScript(text: string): boolean {
  return /[ऀ-ॿఀ-౿]/.test(text);
}

/** Convert Telugu/Devanagari letters to Roman; everything else passes through unchanged. */
export function toLatin(input: string): string {
  const s = input.replace(/[‌‍]/g, '').replace(/[।॥]/g, '.');
  const chars = [...s];
  let out = '';
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const t = tableFor(ch);
    if (!t) { out += ch; continue; }

    const d = t.digits.indexOf(ch);
    if (d >= 0) { out += String(d); continue; }
    if (t.vowels[ch]) { out += t.vowels[ch]; continue; }
    if (t.anusvara.includes(ch)) {
      const next = nextConsonant(chars, i + 1, t);
      out += next === undefined ? (t === TELUGU ? 'm' : 'n') : LABIALS.has(next) ? 'm' : 'n';
      continue;
    }
    if (ch === t.visarga) { out += 'h'; continue; }
    if (t.matras[ch] || ch === t.virama || ch === t.nukta) continue; // handled with the consonant

    let base = t.consonants[ch];
    if (base === undefined) { out += ch; continue; }
    let j = i + 1;
    if (t.nukta && chars[j] === t.nukta) { base = t.nuktaMap?.[ch] ?? base; j++; }
    const next = chars[j];
    if (next === t.virama) { out += base; i = j; continue; }
    if (next && t.matras[next]) { out += base + t.matras[next]; i = j; continue; }
    // inherent vowel
    const atWordEnd = !next || !tableFor(next) || t.digits.includes(next);
    out += base + (atWordEnd && t.dropFinalA ? '' : 'a');
    i = j - 1;
  }
  return out;
}

function nextConsonant(chars: string[], j: number, t: Table): string | undefined {
  const c = chars[j];
  return c && t.consonants[c] ? t.consonants[c] : undefined;
}
