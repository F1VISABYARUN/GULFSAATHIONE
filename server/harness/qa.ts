// L0 Q/A layer: read a short answer using the question that was asked.
// "లేదు" alone means nothing; after "is your passport with you?" it means the passport is held.
// Bot questions come from the call transcript (Bolna gives both sides).

export interface Turn { text: string; q?: string }

const NEG = /(లేదు|లేదండి|రాలేదు|రాలేదండి|ఇవ్వలేదు|నై\b|नहीं|नाही|\bno\b|\bledu\b|\bledandi\b|\braaledu\b)/i;

// A yes/no answer has polarity only after a positive, single receipt question.
// Other salary questions ("how much?", "hasn't it arrived?") need their own evidence.
export const CONFIRM_SALARY = 'మీ జీతం మీకు వచ్చిందా?';

export function salaryReceipt(turn: Turn): boolean | 'unknown' | undefined {
  const q = turn.q?.toLowerCase();
  if (!q || !/(జీతం|salary|wages|jeetham|jitham|वेतन|तनख्वाह|వేతనం|వేతనము)/u.test(q)) return undefined;
  if (/రాలేదా|ఇవ్వలేదా|అందలేదా/u.test(q)) return 'unknown';
  if (!/(मिला|मिली|వచ్చిందా|అందిందా|ఇచ్చారా|పడ్డదా|పడిందా|paid|receiv|did you get|vachinda)/iu.test(q)) return undefined;
  if (/\b(or|and|how|when|where|who|why|not|never)\b|n['’]t|ఎంత|ఎప్పుడు|లేదా|రాలేదా|[?？].+\S/u.test(q)) return 'unknown';
  const a = turn.text.toLowerCase().trim().replace(/[.,!?।？]+$/gu, '').trim();
  if (/^(?:no|nope|not yet|i (?:didn['’]t|did not) (?:get|receive) it|नहीं|नाही|they (?:didn['’]t|did not) (?:give|pay)(?: (?:it|me))?|లేదు|లేదు అండి|లేదండి|రాలేదు|రాలేదండి|ఇవ్వలేదు|ఇవ్వలేదండి|అందలేదు|లేదు సార్|ledu|raaledu|raledu)$/u.test(a)) return false;
  if (/^(?:yes|yes i did|received|i (?:got|received) it|అవును|అవునండి|వచ్చింది|వచ్చిందండి|అందింది|పడింది|हाँ|हां|avunu|vachindi)$/u.test(a)) return true;
  return 'unknown';
}

export function withQuestionContext(turns: Turn[]): string {
  return turns.map(t => {
    const paid = salaryReceipt(t);
    if (typeof paid === 'boolean') return paid ? `${t.text} [jeetham paid]` : `${t.text} [జీతం రాలేదు]`;
    if (!t.q || !NEG.test(t.text)) return t.text;
    if (/పాస్‌?పోర్ట్|passport|पासपोर्ट/i.test(t.q)) return `${t.text} [పాస్పోర్ట్ లేదు]`;
    if (/తీసుకెళ్ల|వాళ్లేనా|picked|pick up|लेने/i.test(t.q) && /వేరే|కొత్త|other|vere|दूसरे/i.test(t.text)) return `${t.text} [వేరే వాళ్ళు తీసుకెళ్లారు]`;
    return t.text;
  }).join(' . ');
}

/** Parse a Bolna transcript ("assistant: ...\nuser: ...") into caller turns with the preceding bot line. */
export function parseBolnaTranscript(transcript: string): Turn[] {
  const turns: Turn[] = [];
  let lastBot = '';
  for (const line of transcript.split('\n')) {
    const m = line.match(/^(assistant|user):\s*(.*)$/);
    if (!m) continue;
    if (m[1] === 'assistant') lastBot = m[2].trim();
    else if (m[2].trim()) turns.push({ text: m[2].trim(), q: /[?？]\s*$/.test(lastBot) ? lastBot : undefined });
  }
  return turns;
}
