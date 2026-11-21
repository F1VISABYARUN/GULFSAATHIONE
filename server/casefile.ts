// Case file: turns one or more heard calls into a ready-to-send file for the people who can act
// (Indian mission in the Gulf, MADAD, Protector of Emigrants, Telangana NRI cell, family).
// Every fact in it points back to the words the worker actually said.

import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runHarness, ALL_ON, type HarnessResult } from './harness/index.ts';
import { assessRisks, type Risk, type Severity } from './risk/engine.ts';
import type { CallContext, CaseSlots } from './harness/types.ts';

const DATA = join(dirname(fileURLToPath(import.meta.url)), 'data');

export interface CallInput { text: string; date?: string; kind?: string; id?: string }
export interface Helpline { country: string; mission?: string; kind?: string; value: string; source_url?: string; status?: string }

export interface CaseFile {
  id: string;
  createdAt: string;
  worker: { name?: string; district?: string; country?: string };
  severity: Severity | 'none';
  escalate: boolean;
  facts: CaseSlots;
  promise?: CaseSlots;
  promiseVsNow: { item: string; promised?: string; now?: string; mismatch: boolean }[];
  risks: (Risk & { evidence?: string; callId?: string; date?: string })[];
  timeline: { date?: string; kind?: string; callId?: string; heard: string; risks: string[] }[];
  actions: { who: string; what: string; contacts: Helpline[] }[];
  summaryEn: string;
  summaryTe: string;
}

export function loadHelplines(): Helpline[] {
  const p = join(DATA, 'research', 'helplines.json');
  if (!existsSync(p)) return [];
  try {
    const raw = JSON.parse(readFileSync(p, 'utf8'));
    return (Array.isArray(raw) ? raw : raw.helplines ?? []) as Helpline[];
  } catch { return []; }
}

const SEV: Record<string, number> = { critical: 0, high: 1, medium: 2 };

/** Which words in the call triggered a risk (quoted back as evidence). */
function evidenceFor(riskId: string, h: HarnessResult): string | undefined {
  const pick = (pred: (e: HarnessResult['entities'][number]) => boolean) => h.entities.filter(e => !e.superseded && pred(e)).map(e => e.surface);
  const map: Record<string, () => string[]> = {
    DISTRESS: () => pick(e => e.type === 'distress' && ['violence', 'threat', 'help', 'deprivation', 'confinement'].includes(String(e.value))),
    CODE_PHRASE: () => ['(safety phrase used — not quoted)'],
    TAKEN_BY_STRANGER: () => pick(e => e.value === 'taken_by_stranger'),
    PASSPORT_HELD: () => pick(e => e.value === 'passport_held'),
    SALARY_UNPAID: () => pick(e => e.value === 'salary_unpaid' || e.value === 'mafi_fulus'),
    VISIT_VISA: () => pick(e => e.value === 'visit_visa'),
    HUROOB: () => pick(e => e.value === 'huroob'),
    FEE_ABOVE_CAP: () => pick(e => e.type === 'money'),
    JOB_MISMATCH: () => pick(e => e.type === 'job'),
    HOURS_MISMATCH: () => pick(e => e.type === 'hours'),
    SALARY_MISMATCH: () => pick(e => e.type === 'money'),
  };
  const got = map[riskId]?.() ?? [];
  return got.length ? [...new Set(got)].map(s => `“${s}”`).join(', ') : undefined;
}

function mergeSlots(all: CaseSlots[]): CaseSlots {
  const out: CaseSlots = {};
  for (const s of all) {
    for (const [k, v] of Object.entries(s)) {
      if (v === undefined) continue;
      if (Array.isArray(v)) (out as Record<string, unknown>)[k] = [...new Set([...(((out as Record<string, unknown>)[k] as unknown[]) ?? []), ...v])];
      else (out as Record<string, unknown>)[k] = v; // later calls win
    }
  }
  return out;
}

function actionsFor(risks: Risk[], facts: CaseSlots, helplines: Helpline[]): CaseFile['actions'] {
  const ids = new Set(risks.map(r => r.id));
  const abroad = facts.country && facts.country !== 'India';
  const missionContacts = helplines.filter(h => abroad && h.country && h.country.toLowerCase().includes(String(facts.country).toLowerCase().split(' ')[0]));
  const india = helplines.filter(h => h.country === 'India');
  const byName = (re: RegExp) => india.filter(h => re.test(`${h.mission ?? ''} ${h.kind ?? ''} ${h.value}`));
  const actions: CaseFile['actions'] = [];
  if (ids.has('DISTRESS') || ids.has('CODE_PHRASE') || ids.has('TAKEN_BY_STRANGER') || ids.has('HUROOB')) {
    actions.push({ who: 'Saathi caseworker (human) — now', what: 'Call the worker back within minutes; confirm safety, exact location (building, shop, mosque, road), and whether he can speak freely.', contacts: [] });
    actions.push({ who: `Indian mission${facts.country ? ' in ' + facts.country : ''}`, what: 'Share this file with the mission welfare desk; request urgent welfare check / rescue.', contacts: missionContacts });
    actions.push({ who: 'Family', what: 'Inform the family contact on record that a case is open (do not share the safety phrase).', contacts: [] });
  }
  if (ids.has('PASSPORT_HELD') || ids.has('SALARY_UNPAID') || ids.has('JOB_MISMATCH') || ids.has('SALARY_MISMATCH') || ids.has('HOURS_MISMATCH')) {
    actions.push({ who: 'MADAD (MEA grievance portal)', what: 'Register a grievance with this file: passport retention / unpaid wages / contract substitution.', contacts: byName(/madad/i) });
  }
  if (ids.has('FEE_ABOVE_CAP') || ids.has('VISIT_VISA') || ids.has('AGENT_NOT_IN_REGISTRY') || ids.has('AGENT_DISTRICT_MISMATCH') || ids.has('AGENT_FLAGGED')) {
    actions.push({ who: 'Protector of Emigrants, Hyderabad / eMigrate', what: 'Complain against the recruiting agent: illegal fee, visit visa for a job, unregistered agent. Attach payment proof.', contacts: [...byName(/protector|poe/i), ...byName(/emigrate/i)] });
    if (!abroad) actions.push({ who: 'Worker (before departure)', what: 'Do not pay more and do not travel until the agent licence and an employment visa are verified.', contacts: [] });
  }
  if (actions.length) actions.push({ who: 'Telangana NRI / TOMCOM', what: 'Copy the state NRI cell for follow-up and welfare support.', contacts: byName(/tomcom|telangana|nri/i) });
  return actions;
}

export function buildCaseFile(calls: CallInput[], ctx: CallContext = {}, opts: { id?: string; workerName?: string } = {}): CaseFile {
  const runs = calls.map(c => ({ c, h: runHarness(c.text, ctx, ALL_ON) }));
  const facts = mergeSlots(runs.map(r => r.h.slots));
  const riskMap = new Map<string, CaseFile['risks'][number]>();
  const timeline: CaseFile['timeline'] = [];
  for (const { c, h } of runs) {
    const rs = assessRisks(h.slots, ctx.promise).filter(r => !r.id.startsWith('AGENT_') || (ctx as { trustAgentList?: boolean }).trustAgentList);
    timeline.push({ date: c.date, kind: c.kind, callId: c.id, heard: h.corrected.slice(0, 400), risks: rs.map(r => r.id) });
    for (const r of rs) if (!riskMap.has(r.id)) riskMap.set(r.id, { ...r, evidence: evidenceFor(r.id, h), callId: c.id, date: c.date });
  }
  const risks = [...riskMap.values()].sort((a, b) => SEV[a.severity] - SEV[b.severity]);
  const promise = ctx.promise;
  const row = (item: string, p?: unknown, n?: unknown) => ({ item, promised: p === undefined ? undefined : String(p), now: n === undefined ? undefined : String(n), mismatch: p !== undefined && n !== undefined && String(p).toLowerCase() !== String(n).toLowerCase() });
  const promiseVsNow = promise ? [
    row('Employer / who picked up', promise.employerName, facts.takenByStranger ? 'someone else (stranger)' : facts.pickupName),
    row('Job', promise.job, facts.job),
    row('Salary', promise.salary ? `${promise.salary.amount} ${promise.salary.currency ?? ''}`.trim() : undefined, facts.salary ? `${facts.salary.amount} ${facts.salary.currency ?? ''}`.trim() : undefined),
    row('Hours/day', promise.hoursPerDay, facts.hoursPerDay),
    row('Salary paid', promise.salary ? 'yes' : undefined, facts.salaryPaid === undefined ? undefined : facts.salaryPaid ? 'yes' : 'no'),
    row('Passport with worker', 'yes', facts.passportHeld ? 'no' : undefined),
  ].filter(r => r.promised !== undefined || r.now !== undefined) : [];

  const severity = risks[0]?.severity ?? 'none';
  const escalate = runs.some(r => r.h.escalate);
  const name = opts.workerName ?? ctx.names?.[0];
  const top = risks.slice(0, 4).map(r => r.en.split(' — ')[0]).join('; ');
  return {
    id: opts.id ?? `GS-${Date.now().toString(36).toUpperCase()}`,
    createdAt: new Date().toISOString(),
    worker: { name, district: facts.district, country: facts.country },
    severity, escalate, facts, promise, promiseVsNow, risks, timeline,
    actions: actionsFor(risks, facts, loadHelplines()),
    summaryEn: risks.length ? `${name ?? 'Worker'}${facts.country ? ` (${facts.country})` : ''}: ${top}.` : `${name ?? 'Worker'}: no risk found in ${calls.length} call(s).`,
    summaryTe: risks.length ? `${name ?? 'Worker'}: ${risks.slice(0, 4).map(r => r.te.split(' — ')[0]).join('; ')}.` : `${name ?? 'Worker'}: ibbandi emi kanapadaledu.`,
  };
}

// ---------------------------------------------------------------- printable HTML
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export function renderCaseFileHtml(cf: CaseFile): string {
  const sevColor = cf.severity === 'critical' ? '#8f1d14' : cf.severity === 'high' ? '#a86a00' : '#1f7a4d';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Case ${esc(cf.id)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Telugu:wght@400;600&display=swap">
<style>
body{font:14px/1.5 system-ui,"Noto Sans Telugu",sans-serif;color:#1d1d1b;background:#fff;max-width:820px;margin:0 auto;padding:24px 16px}
h1{font-size:20px;margin:0}h2{font-size:14px;text-transform:uppercase;letter-spacing:.05em;color:#6b6a64;margin:22px 0 8px;border-bottom:1px solid #e3e1da;padding-bottom:4px}
.sev{display:inline-block;color:#fff;background:${sevColor};padding:2px 10px;border-radius:999px;font-weight:600;font-size:12px}
table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:6px 8px;border-bottom:1px solid #eee;vertical-align:top}th{color:#6b6a64;font-size:12px}
.mis{color:#c43d2f;font-weight:600}.muted{color:#6b6a64;font-size:12px}.risk{margin:6px 0;padding:6px 10px;border-left:3px solid ${sevColor};background:#faf8f3}
@media print{.noprint{display:none}}
</style></head><body>
<p class="muted">Gulf Saathi case file · generated ${esc(cf.createdAt.slice(0, 16).replace('T', ' '))} UTC · machine-generated from call audio; verify before official use</p>
<h1>Case ${esc(cf.id)} <span class="sev">${esc(cf.severity.toUpperCase())}</span>${cf.escalate ? ' <span class="sev">ESCALATE</span>' : ''}</h1>
<p><b>${esc(cf.summaryEn)}</b><br>${esc(cf.summaryTe)}</p>
<h2>Worker</h2><table><tr><th>Name</th><td>${esc(cf.worker.name ?? '—')}</td><th>District</th><td>${esc(cf.worker.district ?? '—')}</td><th>Country now</th><td>${esc(cf.worker.country ?? '—')}</td></tr></table>
<h2>Risks (with the words heard)</h2>
${cf.risks.map(r => `<div class="risk"><b>${esc(r.id)}</b> — ${esc(r.en)}<br><span>${esc(r.te)}</span>${r.evidence ? `<br><span class="muted">Heard: ${esc(r.evidence)}${r.date ? ' · ' + esc(r.date) : ''}</span>` : ''}</div>`).join('') || '<p class="muted">None.</p>'}
${cf.promiseVsNow.length ? `<h2>Promise vs now</h2><table><tr><th>Item</th><th>Promised</th><th>Now</th></tr>${cf.promiseVsNow.map(r => `<tr><td>${esc(r.item)}</td><td>${esc(r.promised ?? '—')}</td><td class="${r.mismatch ? 'mis' : ''}">${esc(r.now ?? '—')}</td></tr>`).join('')}</table>` : ''}
<h2>Recommended actions</h2><table><tr><th>Who</th><th>What</th><th>Contact</th></tr>
${cf.actions.map(a => `<tr><td>${esc(a.who)}</td><td>${esc(a.what)}</td><td>${a.contacts.map(c => `${esc(c.kind ?? '')} ${esc(c.value)}${c.status && c.status !== 'official' ? ' <span class="muted">(' + esc(c.status) + ')</span>' : ''}`).join('<br>') || '<span class="muted">see helpline list</span>'}</td></tr>`).join('')}</table>
<h2>Call timeline</h2><table><tr><th>Date</th><th>Call</th><th>What was heard (after harness)</th><th>Risks</th></tr>
${cf.timeline.map(t => `<tr><td>${esc(t.date ?? '')}</td><td>${esc(t.kind ?? t.callId ?? '')}</td><td>${esc(t.heard)}</td><td>${esc(t.risks.join(', '))}</td></tr>`).join('')}</table>
<p class="muted">Facts extracted: ${esc(JSON.stringify(cf.facts))}</p>
<p class="noprint"><button onclick="print()">Print / save as PDF</button></p>
</body></html>`;
}
