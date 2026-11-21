// Live integration: the gate Bolna (or any voice agent) can call mid-call, and the post-call webhook.

import type { Express } from 'express';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runHarness, ALL_ON } from './harness/index.ts';
import { withQuestionContext, parseBolnaTranscript, type Turn } from './harness/qa.ts';
import { assessRisks } from './risk/engine.ts';
import { buildCaseFile, renderCaseFileHtml, type CaseFile } from './casefile.ts';
import type { CallContext } from './harness/types.ts';

const CASES = join(dirname(fileURLToPath(import.meta.url)), 'data', 'cases');

/** Map Bolna recipient_data (what the user's Saathi backend sends) to harness context. */
export function contextFromRecipient(rd: Record<string, unknown> = {}): CallContext {
  const s = (k: string) => (typeof rd[k] === 'string' && rd[k] ? String(rd[k]) : undefined);
  const promise = s('employer_name') || s('promised_job') ? { employerName: s('employer_name'), job: s('promised_job')?.toLowerCase() } : undefined;
  return {
    names: [s('worker_name'), s('employer_name'), s('sponsor_name')].filter(Boolean) as string[],
    places: [s('dest_city'), s('dest_country')].filter(Boolean).map(p => p!.charAt(0) + p!.slice(1).toLowerCase()),
    promise, codePhrase: s('code_phrase'),
  };
}

/** What the voice agent should do next — deterministic, not left to the LLM prompt. */
export function gateDecision(turns: Turn[], ctx: CallContext) {
  const h = runHarness(withQuestionContext(turns), ctx, ALL_ON);
  const risks = assessRisks(h.slots, ctx.promise).filter(r => !r.id.startsWith('AGENT_'));
  const critical = risks.some(r => r.severity === 'critical');
  const action = h.escalate || critical ? 'ESCALATE' : h.readBacks.length ? 'CONFIRM' : risks.length ? 'NOTE' : 'CONTINUE';
  const sayTe =
    action === 'ESCALATE' ? (h.slots.codePhrase
      ? 'సరే, అర్థమైంది. మీరు మామూలుగా మాట్లాడండి.' // never reveal the code phrase was detected
      : 'మీరు ఒంటరి కాదు. ఇప్పుడే మా మనిషి మీకు కాల్ చేస్తారు. మీరు ఉన్న దగ్గర కనిపించే షాప్, బిల్డింగ్ లేదా రోడ్డు పేరు చెప్పగలరా?')
    : action === 'CONFIRM' ? h.readBacks[0].te
    : undefined;
  return {
    action, sayTe,
    // instruction for the LLM agent; keeps it from promising things that did not happen
    instruction: action === 'ESCALATE'
      ? 'A human caseworker has been alerted. Keep the caller on the line, ask only for location and safety. Do NOT say the family or embassy was informed unless the backend confirms it. Do not end the call.'
      : action === 'CONFIRM' ? 'Read back the uncertain item and wait for yes/no before saving it.' : 'Continue the conversation.',
    risks: risks.map(r => ({ id: r.id, severity: r.severity, te: r.te, en: r.en })),
    readBacks: h.readBacks, slots: h.slots, corrected: h.corrected,
  };
}

function saveCase(cf: CaseFile & { source?: unknown }) {
  mkdirSync(CASES, { recursive: true });
  writeFileSync(join(CASES, `${cf.id}.json`), JSON.stringify(cf, null, 2));
}
function loadCase(id: string): CaseFile | undefined {
  const p = join(CASES, `${id.replace(/[^A-Za-z0-9_-]/g, '')}.json`);
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : undefined;
}

export function registerLive(app: Express) {
  // Mid-call gate. Body: { transcript?: "assistant: ..\nuser: ..", turns?: Turn[], text?: string, context?: CallContext, recipient_data?: {...} }
  app.post('/api/gate', (req, res) => {
    const b = req.body ?? {};
    const turns: Turn[] = b.turns ?? (b.transcript ? parseBolnaTranscript(String(b.transcript)) : [{ text: String(b.text ?? '') }]);
    const ctx: CallContext = { ...contextFromRecipient(b.recipient_data), ...(b.context ?? {}) };
    res.json(gateDecision(turns, ctx));
  });

  // Ad-hoc case file from transcripts. Body: { calls: [{text, date, kind}], context, workerName }
  app.post('/api/casefile', (req, res) => {
    const b = req.body ?? {};
    const cf = buildCaseFile(b.calls ?? [], b.context ?? {}, { workerName: b.workerName });
    if (b.save) saveCase(cf);
    res.json(cf);
  });

  // Post-call webhook (point the Bolna agent's webhook_url here). Accepts the Bolna execution payload.
  app.post('/webhooks/bolna', (req, res) => {
    const e = req.body ?? {};
    if (!e.transcript || typeof e.transcript !== 'string') return res.json({ ok: true, ignored: 'no transcript yet' });
    const rd = e.context_details?.recipient_data ?? {};
    const ctx = contextFromRecipient(rd);
    const turns = parseBolnaTranscript(e.transcript);
    const base = String(rd.case_id ?? 'CALL').replace(/[^A-Za-z0-9-]/g, '').slice(0, 24);
    const id = `${base.startsWith('GS-') ? base : 'GS-' + base}-${String(e.id ?? Date.now()).replace(/[^A-Za-z0-9]/g, '').slice(0, 8)}`;
    const cf = buildCaseFile([{ text: withQuestionContext(turns), date: String(e.created_at ?? e.initiated_at ?? '').slice(0, 10), kind: String(rd.call_kind ?? 'call'), id: String(e.id ?? '') }], ctx, { id, workerName: rd.worker_name });
    saveCase({ ...cf, source: { provider: 'bolna', execution_id: e.id, agent_id: e.agent_id } });
    res.json({ ok: true, case_id: cf.id, escalate: cf.escalate, severity: cf.severity, risks: cf.risks.map(r => r.id) });
  });

  app.get('/api/cases', (_req, res) => {
    if (!existsSync(CASES)) return res.json([]);
    const list = readdirSync(CASES).filter(f => f.endsWith('.json')).map(f => JSON.parse(readFileSync(join(CASES, f), 'utf8')) as CaseFile)
      .map(c => ({ id: c.id, createdAt: c.createdAt, worker: c.worker, severity: c.severity, escalate: c.escalate, risks: c.risks.map(r => r.id), summaryEn: c.summaryEn }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json(list);
  });
  app.get('/cases/:id', (req, res) => {
    const cf = loadCase(String(req.params.id));
    if (!cf) return res.status(404).send('Case not found');
    res.type('html').send(renderCaseFileHtml(cf));
  });
}
