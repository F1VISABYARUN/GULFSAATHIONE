// L0 Q/A layer: read a short answer using the question that was asked.
// "లేదు" alone means nothing; after "is your passport with you?" it means the passport is held.
// Bot questions come from the call transcript (Bolna gives both sides).

export interface Turn { text: string; q?: string }

const NEG = /(లేదు|లేదండి|రాలేదు|రాలేదండి|ఇవ్వలేదు|నై\b|नहीं|नाही|\bno\b|\bledu\b|\bledandi\b|\braaledu\b)/i;

export function withQuestionContext(turns: Turn[]): string {
  return turns.map(t => {
    if (!t.q || !NEG.test(t.text)) return t.text;
    if (/జీతం|salary|jeetham|वेतन|तनख्वाह/i.test(t.q)) return `${t.text} [జీతం రాలేదు]`;
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
