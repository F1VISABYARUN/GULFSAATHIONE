// Deterministic check-in conversation: which question to ask next, in Telugu, and what the answers mean.
// The LLM only has to speak the line; the order, the meaning of "లేదు", and escalation are decided here.

import { runHarness, ALL_ON } from './harness/index.ts';
import { withQuestionContext, type Turn } from './harness/qa.ts';
import { assessRisks } from './risk/engine.ts';
import type { CallContext, CaseSlots } from './harness/types.ts';

export type Kind = 'briefing' | 'arrival' | 'weekly';

interface Q { id: string; te: string; done: (s: CaseSlots, answered: Set<string>) => boolean }

const ASKED = (id: string) => (_s: CaseSlots, a: Set<string>) => a.has(id);

const FLOWS: Record<Kind, Q[]> = {
  briefing: [
    { id: 'visa', te: 'మీకు ఇచ్చింది వర్క్ వీసానా, విజిట్ వీసానా?', done: s => s.visaType !== undefined },
    { id: 'fee', te: 'ఏజెంట్‌కి మొత్తం ఎంత డబ్బు ఇచ్చారు?', done: s => s.feeINR !== undefined },
    { id: 'agent', te: 'ఏజెంట్ పేరు, ఏ జిల్లా? లైసెన్స్ నంబర్ ఉంటే చెప్పండి.', done: s => s.agentName !== undefined },
    { id: 'job', te: 'అక్కడ ఏ పని అని చెప్పారు? జీతం ఎంత?', done: s => s.job !== undefined && s.salary !== undefined },
  ],
  arrival: [
    { id: 'arrived', te: 'మీరు చేరుకున్నారా? ఏ ఊరిలో ఉన్నారు?', done: s => s.country !== undefined || (s.places?.length ?? 0) > 0 },
    { id: 'pickup', te: 'మిమ్మల్ని ఎవరు తీసుకెళ్లారు? మీ కంపెనీ వాళ్లేనా?', done: (s, a) => s.takenByStranger !== undefined || a.has('pickup') },
    { id: 'passport', te: 'మీ పాస్‌పోర్ట్ మీ దగ్గరే ఉందా?', done: (s, a) => s.passportHeld !== undefined || a.has('passport') },
    { id: 'job', te: 'అక్కడ ఏ పని చెప్పారు?', done: s => s.job !== undefined },
  ],
  weekly: [
    { id: 'salary', te: 'ఈ నెల జీతం వచ్చిందా?', done: (s, a) => s.salaryPaid !== undefined || a.has('salary') },
    { id: 'passport', te: 'మీ పాస్‌పోర్ట్ మీ దగ్గరే ఉందా?', done: (s, a) => s.passportHeld !== undefined || a.has('passport') },
    { id: 'hours', te: 'రోజుకు ఎన్ని గంటలు పని చేస్తున్నారు?', done: s => s.hoursPerDay !== undefined },
    { id: 'safe', te: 'మీరు క్షేమంగా ఉన్నారా? ఏమైనా ఇబ్బంది ఉందా?', done: ASKED('safe') },
  ],
};

export interface FlowTurn { q: string; qid: string; a: string }
export interface FlowState { kind: Kind; turns: FlowTurn[] }

export function nextStep(state: FlowState, ctx: CallContext = {}) {
  const turns: Turn[] = state.turns.map(t => ({ text: t.a, q: t.q }));
  const h = runHarness(withQuestionContext(turns), ctx, ALL_ON);
  const slots = h.slots;
  // a plain "yes" to "was it your company?" means the employer picked him up
  for (const t of state.turns) if (t.qid === 'pickup' && /(అవును|avunu|haan|yes|వాళ్ళే)/i.test(t.a) && slots.takenByStranger === undefined) slots.takenByStranger = false;
  const answered = new Set(state.turns.map(t => t.qid));
  const risks = assessRisks(slots, ctx.promise).filter(r => !r.id.startsWith('AGENT_'));

  if (h.escalate || risks.some(r => r.severity === 'critical')) {
    return { action: 'ESCALATE' as const, sayTe: slots.codePhrase ? 'సరే, అర్థమైంది. మామూలుగా మాట్లాడండి.' : 'మీరు ఒంటరి కాదు. ఇప్పుడే మా మనిషి మీకు కాల్ చేస్తారు. మీరు ఉన్న దగ్గర కనిపించే షాప్ లేదా రోడ్డు పేరు చెప్పండి.', slots, risks };
  }
  if (h.readBacks.length) return { action: 'CONFIRM' as const, sayTe: h.readBacks[0].te, slots, risks };
  const q = FLOWS[state.kind].find(x => !x.done(slots, answered));
  if (q) return { action: 'ASK' as const, qid: q.id, sayTe: q.te, slots, risks };
  return { action: risks.length ? 'NOTE' as const : 'DONE' as const, sayTe: risks.length ? 'మీరు చెప్పింది నమోదు చేశాను. మా మనిషి త్వరలో మీకు కాల్ చేస్తారు.' : 'ధన్యవాదాలు. జాగ్రత్తగా ఉండండి, మళ్ళీ కాల్ చేస్తాం.', slots, risks };
}
