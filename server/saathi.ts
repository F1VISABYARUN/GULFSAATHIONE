// New Gulf Saathi backend: worker registration, Bolna tool endpoints, call scheduler.
// Every tool takes the caller's own words (caller_said) and runs them through the harness, so the
// LLM's guesses never decide risk on their own.

import type { Express, Request, Response } from 'express';
import { runHarness, ALL_ON } from './harness/index.ts';
import { withQuestionContext, parseBolnaTranscript } from './harness/qa.ts';
import { assessRisks, type Risk } from './risk/engine.ts';
import { checkAgent } from './risk/agents.ts';
import { store, newCaseId, type WorkerRec } from './store.ts';
import { buildCaseFile } from './casefile.ts';
import { familyProvider, type SmsStatus } from './family-sms.ts';
import type { CaseSlots } from './harness/types.ts';

const FEE_CAP = 30000 * 1.18;
const LEVEL: Record<string, number> = { ok: 0, medium: 1, high: 2, critical: 3 };

function levelOf(risks: Risk[]): WorkerRec['riskLevel'] {
  return risks.reduce<WorkerRec['riskLevel']>((acc, r) => (LEVEL[r.severity] > LEVEL[acc] ? r.severity : acc), 'ok');
}

/** What the voice agent should say for a risk level (Telugu). Never promises rescue or claims actions. */
export function instructionFor(level: WorkerRec['riskLevel'], codePhrase: boolean): string {
  if (codePhrase) return 'సరే, అర్థమైంది. మామూలుగా మాట్లాడండి.';
  return {
    critical: 'మీరు ఒంటరి కాదు. మీ కేసు అత్యవసరం అని నమోదైంది, మా మనిషి ఇప్పుడే చూస్తారు. మీరు ఉన్న దగ్గర కనిపించే షాప్, బిల్డింగ్ లేదా రోడ్డు పేరు చెప్పండి.',
    high: 'మీ సమస్య నమోదైంది. మా మనిషి ఎంబసీతో మాట్లాడటానికి దీన్ని తీసుకుంటారు. జీతం లేదా పాస్‌పోర్ట్ తిరిగి వస్తుందని మేము హామీ ఇవ్వలేము.',
    medium: 'నమోదు చేశాను. సాథి మళ్ళీ మిమ్మల్ని కాల్ చేస్తుంది.',
    ok: 'మంచిది, బాగున్నారని నమోదు చేశాను. వచ్చే వారం మళ్ళీ కాల్ చేస్తాం.',
  }[level];
}

export async function applyToWorker(caseId: string, slots: CaseSlots, kind: string, transcript?: string, sms = familyProvider()) {
  const w = await store.worker(caseId);
  const risks = assessRisks(slots, w?.promise).filter(r => !r.id.startsWith('AGENT_'));
  const level = levelOf(risks);
  await store.addCall({ id: `${caseId}-${Date.now()}`, caseId, kind, at: new Date().toISOString(), status: 'answered', transcript, reasons: risks.map(r => r.id) });
  const target = await store.change(caseId, worker => {
    const alert = level === 'critical' || level === 'high';
    const crossing = LEVEL[worker.riskLevel] < LEVEL.high && alert;
    if (LEVEL[level] > LEVEL[worker.riskLevel]) worker.riskLevel = level;
    worker.reasons = [...new Set([...worker.reasons, ...risks.map(r => r.id)])];
    if (worker.status === 'closed') return;
    if (alert) {
      if (crossing) worker.alertSince = new Date().toISOString();
      worker.status = 'alert';
    }
    else if (worker.status === 'registered') worker.status = 'abroad';
    if (crossing && worker.familyPhone && !worker.familySms) {
      worker.familySms = { sentAt: new Date().toISOString(), status: 'pending' };
      return worker.familyPhone;
    }
  });
  let smsStatus: SmsStatus | undefined;
  if (target) {
    try { smsStatus = await sms.send(target, caseId); } catch { smsStatus = 'failed'; }
    const status = smsStatus;
    await store.change(caseId, worker => { if (worker.familySms) worker.familySms.status = status; });
  }
  return { risks, level, smsStatus };
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');

export function isOverdue(w: WorkerRec, now = Date.now()) {
  if (w.status === 'closed' || LEVEL[w.riskLevel] < LEVEL.high) return false;
  const since = Math.max(Date.parse(w.alertSince ?? w.createdAt), Date.parse(w.notes?.at(-1)?.at ?? w.alertSince ?? w.createdAt));
  return now - since >= 24 * 3600_000;
}

export function registerSaathi(app: Express, guard: (req: Request, res: Response, next: () => void) => void) {
  // ---- worker registration (before departure) -----------------------------------------
  app.post('/api/saathi/workers', guard, async (req, res) => {
    const b = req.body ?? {};
    if (!b.phone || !b.consent) return res.status(400).json({ error: 'phone and consent are required' });
    const promise = runHarness(str(b.promise_said), {}, ALL_ON).slots;   // promise in the worker's own words
    const rec = await store.addWorker({
      caseId: b.caseId || newCaseId(), name: b.name, phone: b.phone, familyPhone: b.familyPhone, district: b.district ?? promise.district,
      promise: { ...promise, employerName: b.employerName ?? promise.employerName, job: b.job ?? promise.job },
      destCity: b.destCity, destCountry: b.destCountry, codePhrase: b.codePhrase, departedOn: b.departedOn, consent: true,
    });
    const preDeparture = assessRisks(rec.promise).filter(r => ['VISIT_VISA', 'FEE_ABOVE_CAP'].includes(r.id));
    res.json({ worker: rec, preDepartureWarnings: preDeparture });
  });
  app.get('/api/saathi/workers/:caseId', guard, async (req, res) => {
    const w = await store.worker(String(req.params.caseId));
    if (!w) return res.status(404).json({ error: 'not found' });
    res.json({ worker: w, calls: await store.calls(w.caseId) });
  });

  app.get('/api/saathi/cases', guard, async (req, res) => {
    const { level, status } = req.query;
    if ((level !== undefined && !['critical','high','medium','ok'].includes(String(level))) ||
        (status !== undefined && !['alert','registered','abroad','closed'].includes(String(status)))) {
      return res.status(400).json({ error: 'invalid filter' });
    }
    const workers = (await store.workers()).filter(w => (!level || w.riskLevel === level) && (!status || w.status === status));
    res.json(workers.map(w => ({ caseId: w.caseId, name: w.name, riskLevel: w.riskLevel, status: w.status,
      overdue: isOverdue(w), notes: w.notes ?? [], outcome: w.outcome, closedAt: w.closedAt })));
  });
  app.get('/api/saathi/cases/:id/file', guard, async (req, res) => {
    const w = await store.worker(String(req.params.id));
    if (!w) return res.sendStatus(404);
    const calls = (await store.calls(w.caseId)).sort((a,b) => a.at.localeCompare(b.at)).map(c => {
      const transcript = c.transcript ?? '';
      const text = /^(assistant|user):/m.test(transcript) ? withQuestionContext(parseBolnaTranscript(transcript)) : transcript;
      return { id: c.id, kind: c.kind, date: c.at, text };
    });
    res.json(buildCaseFile(calls, { promise: w.promise, codePhrase: w.codePhrase, places: w.destCity ? [w.destCity] : [] },
      { id: w.caseId, workerName: w.name }));
  });
  app.post('/api/saathi/cases/:id/note', guard, async (req, res) => {
    const text = str(req.body?.note).trim();
    if (!text || text.length > 4000) return res.status(400).json({ error: 'note must be 1–4000 characters' });
    const note = await store.change(String(req.params.id), w => {
      if (w.status === 'closed') return null;
      const item = { at: new Date().toISOString(), text };
      (w.notes ??= []).push(item);
      return item;
    });
    if (note === undefined) return res.sendStatus(404);
    if (note === null) return res.sendStatus(409);
    res.status(201).json(note);
  });
  app.post('/api/saathi/cases/:id/close', guard, async (req, res) => {
    const outcome = req.body?.outcome;
    if (!['solved','partly','not','withdrawn'].includes(outcome)) return res.status(400).json({ error: 'invalid outcome' });
    const result = await store.change(String(req.params.id), w => {
      if (w.status === 'closed' && w.outcome !== outcome) return null;
      w.status = 'closed'; w.outcome = outcome; w.closedAt ??= new Date().toISOString();
      return { caseId: w.caseId, status: w.status, outcome, closedAt: w.closedAt };
    });
    if (result === undefined) return res.sendStatus(404);
    if (result === null) return res.sendStatus(409);
    res.json(result);
  });

  // ---- Bolna tools ------------------------------------------------------------------------
  // check_agent: { agency, owner, district, licence_no }
  app.post('/tools/check-agent', guard, (req, res) => {
    const b = req.body ?? {};
    const name = str(b.agency) || str(b.owner) || str(b.query);
    const r = checkAgent(name, str(b.district) || undefined, str(b.licence_no) || undefined);
    const say = {
      registered: 'ఈ పేరు ప్రభుత్వ లైసెన్స్ జాబితాలో ఉంది. కానీ మంచివారా కాదా నేను చెప్పలేను; డబ్బు డిజిటల్‌గా ఇచ్చి రసీదు తీసుకోండి.',
      registered_other_district: `ఈ పేరు ${r.match?.district ?? 'వేరే'} జిల్లాలో ఉన్న ఏజెన్సీది. మీ ఏజెంట్ అదేనా? లైసెన్స్ నంబర్ అడగండి.`,
      not_found: 'ఈ పేరు ప్రభుత్వ లైసెన్స్ జాబితాలో దొరకలేదు. డబ్బు ఇచ్చే ముందు లైసెన్స్ నంబర్ అడగండి.',
      flagged: 'ఈ పేరు మీద ఫిర్యాదులు ఉన్నాయి. ఇంకా డబ్బు ఇవ్వకండి.',
    }[r.status];
    res.json({ status: r.status, match: r.match ? { raId: r.match.raId, name: r.match.name, district: r.match.district, rc: r.match.rc } : null, instruction: say, source: r.source });
  });

  // check_fee: { payments: "10000; 25000", caller_said }
  app.post('/tools/check-fee', guard, (req, res) => {
    const b = req.body ?? {};
    const llm = str(b.payments).split(/[;,]/).map(x => Number(x.replace(/[^\d.]/g, ''))).filter(n => n > 0);
    const llmTotal = llm.reduce((a, n) => a + n, 0);
    const heard = b.caller_said ? runHarness(str(b.caller_said), {}, ALL_ON).slots.feeINR : undefined;
    const total = heard ?? llmTotal;
    const over = Math.max(0, total - FEE_CAP);
    const mismatch = heard !== undefined && llmTotal > 0 && Math.abs(heard - llmTotal) > 1;
    res.json({
      total, cap: FEE_CAP, over_cap: over > 0, over_by: over, mismatch: mismatch ? { llm: llmTotal, heard } : undefined,
      instruction: mismatch ? `${heard!.toLocaleString('en-IN')} రూపాయలు అని విన్నాను — ఇది సరైనదేనా?`
        : over > 0 ? `మొత్తం ${total.toLocaleString('en-IN')} రూపాయలు. చట్టం ప్రకారం గరిష్టం 35,400 మాత్రమే; ${over.toLocaleString('en-IN')} ఎక్కువ. ఇంకా డబ్బు ఇవ్వకండి.`
          : 'ఇది చట్టపరమైన పరిమితిలో ఉంది. డిజిటల్‌గా మాత్రమే ఇచ్చి రసీదు తీసుకోండి.',
    });
  });

  // report_problem / record_checkin: { case_id, caller_said, call_kind, ...LLM fields }
  const record = async (req: Request, res: Response) => {
    const b = req.body ?? {};
    let caseId = str(b.case_id);
    if (!caseId || !(await store.worker(caseId))) {
      caseId = newCaseId();
      await store.addWorker({ caseId, phone: str(b.caller_phone) || 'unknown', name: str(b.caller_name) || undefined, promise: {}, consent: true });
    }
    const w = (await store.worker(caseId))!;
    const slots = runHarness(str(b.caller_said) || str(b.notes), { codePhrase: w.codePhrase, names: [w.name, w.promise.employerName].filter(Boolean) as string[] }, ALL_ON).slots;
    // the LLM's yes/no fields can add danger, never remove it
    if (b.threatened === 'yes') slots.distress = [...new Set([...(slots.distress ?? []), 'violence'])];
    if (b.passport_with_worker === 'no') slots.passportHeld = true;
    if (b.taken_by_stranger === 'yes' || ['other_person', 'nobody'].includes(str(b.pickup_status))) slots.takenByStranger = true;
    if (b.salary_received === 'no') slots.salaryPaid = false;
    if (b.code_phrase_used === 'yes') slots.codePhrase = true;
    if (b.movement_restricted === 'yes') slots.distress = [...new Set([...(slots.distress ?? []), 'confinement'])];
    const { risks, level, smsStatus } = await applyToWorker(caseId, slots, str(b.call_kind) || 'report', str(b.caller_said));
    res.json({ case_id: caseId, level, reasons: risks.map(r => r.id), instruction: instructionFor(level, !!slots.codePhrase) + (smsStatus === 'delivered' && !slots.codePhrase ? ' మీ కుటుంబానికి సమాచారం అందింది.' : '') });
  };
  app.post('/tools/report-problem', guard, record);
  app.post('/tools/record-checkin', guard, record);

  // ---- post-call webhook for the new backend: safety net + missed calls ------------------
  app.post('/webhooks/saathi', guard, async (req, res) => {
    const e = req.body ?? {};
    const rd = e.context_details?.recipient_data ?? {};
    const caseId = str(rd.case_id);
    const w = caseId ? await store.worker(caseId) : undefined;
    if (!w) return res.json({ ok: true, ignored: 'unknown case' });
    const answered = e.status === 'completed' && typeof e.transcript === 'string' && /(^|\n)user:/.test(e.transcript);
    if (!answered) {
      await store.addCall({ id: String(e.id ?? Date.now()), caseId, kind: str(rd.call_kind) || 'call', at: new Date().toISOString(), status: String(e.status ?? 'missed'), reasons: ['missed'] });
      return res.json({ ok: true, missed: true });
    }
    const slots = runHarness(withQuestionContext(parseBolnaTranscript(e.transcript)), { codePhrase: w.codePhrase, promise: w.promise }, ALL_ON).slots;
    const { risks, level } = await applyToWorker(caseId, slots, str(rd.call_kind) || 'call', e.transcript);
    res.json({ ok: true, level, reasons: risks.map(r => r.id) });
  });

  // ---- scheduler: which calls are due now; places them through Bolna when configured -------
  const tick = async (now: Date) => {
    const due = dueCalls(now, await store.workers(), await store.calls());
    const placed = [];
    for (const d of due) placed.push(await placeCall(d));
    return { due: due.length, placed };
  };
  app.post('/api/saathi/scheduler/tick', guard, async (req, res) => {
    res.json(await tick(new Date(String(req.body?.now ?? new Date().toISOString()))));
  });
  // Vercel Cron calls GET with "Authorization: Bearer $CRON_SECRET"
  app.get('/api/saathi/cron', async (req, res) => {
    if (process.env.CRON_SECRET && req.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ error: 'unauthorized' });
    res.json(await tick(new Date()));
  });
}

// ---------------------------------------------------------------- scheduling (pure, testable)
export interface DueCall { caseId: string; kind: 'arrival' | 'weekly' | 'retry'; phone: string }

export function dueCalls(now: Date, workers: WorkerRec[], calls: import('./store.ts').CallRec[]): DueCall[] {
  const out: DueCall[] = [];
  for (const w of workers) {
    if (w.status === 'closed' || !w.consent || !w.departedOn) continue;
    const mine = calls.filter(c => c.caseId === w.caseId).sort((a, b) => a.at.localeCompare(b.at));
    const answered = mine.filter(c => c.status === 'answered');
    const last = mine[mine.length - 1];
    const lastAnswered = answered[answered.length - 1];
    const dep = new Date(w.departedOn).getTime();
    const h = (t: number) => (now.getTime() - t) / 3600_000;
    if (h(dep) < 6) continue;                                                   // still flying
    if (last && last.status !== 'answered' && h(new Date(last.at).getTime()) >= (lastAnswered ? 24 : 3)) {
      out.push({ caseId: w.caseId, kind: 'retry', phone: w.phone }); continue;  // retry a missed call
    }
    if (!lastAnswered) { if (!last) out.push({ caseId: w.caseId, kind: 'arrival', phone: w.phone }); continue; }
    if (h(new Date(lastAnswered.at).getTime()) >= 7 * 24) out.push({ caseId: w.caseId, kind: 'weekly', phone: w.phone });
  }
  return out;
}

export async function placeCall(d: DueCall) {
  const key = process.env.BOLNA_API_KEY, agent = process.env.BOLNA_CHECKIN_AGENT_ID;
  const w = (await store.worker(d.caseId))!;
  const user_data = {
    case_id: w.caseId, call_kind: d.kind, worker_name: w.name ?? '', employer_name: w.promise.employerName ?? '',
    promised_job: w.promise.job ?? '', dest_city: w.destCity ?? '', dest_country: w.destCountry ?? '', code_phrase: w.codePhrase ?? '',
  };
  if (!key || !agent) return { ...d, placed: false, reason: 'BOLNA_API_KEY / BOLNA_CHECKIN_AGENT_ID not set (dry run)', user_data };
  if (!/^\+[1-9]\d{7,14}$/.test(d.phone)) return { ...d, placed: false, reason: 'Expected E.164 recipient number' };
  // Bolna Make Call: bearer auth, E.164 recipient, optional caller ID and template variables.
  const r = await fetch('https://api.bolna.ai/call', {
    method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ agent_id: agent, recipient_phone_number: d.phone, from_phone_number: process.env.BOLNA_FROM_PHONE_NUMBER || undefined, user_data }),
  });
  if (!r.ok) return { ...d, placed: false, status: r.status };
  const receipt = await r.json();
  return { ...d, placed: typeof receipt.execution_id === 'string' && !!receipt.execution_id, status: r.status, execution_id: receipt.execution_id };
}
