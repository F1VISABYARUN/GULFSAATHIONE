// Gulf Saathi risk engine. Runs on case slots — identical code for base and harness,
// so any difference in risks caught comes from what was heard, not from the rules.

import type { CaseSlots } from '../harness/types.ts';
import { similarity } from '../harness/phonetic.ts';
import agents from '../data/agents.sample.json' with { type: 'json' };
import config from '../data/rules.json' with { type: 'json' };

export type Severity = 'critical' | 'high' | 'medium';
export interface Risk { id: string; severity: Severity; en: string; te: string; evidence?: string }

const feeCap = config.feeCapINR * (1 + config.gstRate);

function inList(name: string, list: string[]): string | undefined {
  return list.find(n => similarity(n, name) >= 0.85);
}

export function assessRisks(slots: CaseSlots, promise?: CaseSlots): Risk[] {
  const risks: Risk[] = [];
  const add = (r: Risk) => { if (!risks.some(x => x.id === r.id)) risks.push(r); };

  if (slots.distress?.length) add({ id: 'DISTRESS', severity: 'critical', en: `Distress signal (${slots.distress.join(', ')}) — escalate to a human now`, te: 'Pramadam sanketham — ventane manishi ki escalate cheyyali', evidence: slots.distress.join(', ') });
  if (slots.huroob) add({ id: 'HUROOB', severity: 'critical', en: 'Huroob (absconding report) mentioned — worker may be made "illegal"', te: 'Huroob case prastavana — worker illegal ayye pramadam' });
  if (slots.visaType === 'visit') add({ id: 'VISIT_VISA', severity: 'critical', en: 'Visit visa for a job — working on it is illegal', te: 'Job ki visit visa — deenitho pani cheyyadam chattaviruddham' });

  if (slots.agentName) {
    const flagged = inList(slots.agentName, agents.flagged);
    const licensed = inList(slots.agentName, agents.licensed);
    if (flagged) add({ id: 'AGENT_FLAGGED', severity: 'critical', en: `Agent "${slots.agentName}" matches a flagged list entry`, te: `Agent ${slots.agentName} flagged list lo unnadu`, evidence: flagged });
    else if (!licensed) add({ id: 'AGENT_UNLICENSED', severity: 'high', en: `Agent "${slots.agentName}" not found in licensed list`, te: `Agent ${slots.agentName} licensed list lo ledu`, evidence: slots.agentName });
  }
  if (slots.feeINR !== undefined && slots.feeINR > feeCap) {
    add({ id: 'FEE_ABOVE_CAP', severity: 'high', en: `Fee ₹${slots.feeINR.toLocaleString('en-IN')} is above the legal cap (₹${config.feeCapINR.toLocaleString('en-IN')} + GST)`, te: `Fee ₹${slots.feeINR.toLocaleString('en-IN')} — legal limit kante ekkuva`, evidence: String(slots.feeINR) });
  }
  if (slots.passportHeld) add({ id: 'PASSPORT_HELD', severity: 'high', en: 'Passport taken by employer/agent — illegal in Saudi and UAE', te: 'Passport teeskunnaru — idi chattaviruddham' });
  if (slots.salaryPaid === false) add({ id: 'SALARY_UNPAID', severity: 'high', en: 'Salary not being paid', te: 'Jeetham ivvatledu' });
  if (slots.phones?.some(p => !/^\+|^05|^5/.test(p) && p.replace(/\D/g, '').length < 10)) add({ id: 'PHONE_INCOMPLETE', severity: 'medium', en: 'A phone number is incomplete — confirm before saving', te: 'Phone number complete ga ledu — malli confirm cheyyandi' });

  if (promise) {
    if (promise.salary && slots.salary && sameCurrency(promise.salary.currency, slots.salary.currency) && slots.salary.amount < promise.salary.amount) {
      add({ id: 'SALARY_MISMATCH', severity: 'high', en: `Salary now ${slots.salary.amount} vs promised ${promise.salary.amount} ${promise.salary.currency ?? ''}`.trim(), te: `Ippudu ${slots.salary.amount}, cheppindi ${promise.salary.amount} — thakkuva`, evidence: `${promise.salary.amount}→${slots.salary.amount}` });
    }
    if (promise.job && slots.job && promise.job !== slots.job) add({ id: 'JOB_MISMATCH', severity: 'high', en: `Job is "${slots.job}", promised "${promise.job}"`, te: `Cheppina pani ${promise.job}, ippudu ${slots.job}` });
    if (promise.hoursPerDay && slots.hoursPerDay && slots.hoursPerDay > promise.hoursPerDay) add({ id: 'HOURS_MISMATCH', severity: 'medium', en: `${slots.hoursPerDay} h/day vs promised ${promise.hoursPerDay}`, te: `Rojuki ${slots.hoursPerDay} gantalu, cheppindi ${promise.hoursPerDay}` });
    if (promise.employerName && slots.pickupName && similarity(promise.employerName, slots.pickupName) < 0.8) add({ id: 'PICKUP_MISMATCH', severity: 'high', en: `Picked up by "${slots.pickupName}", employer on record is "${promise.employerName}"`, te: `Airport lo ${slots.pickupName} teesukellaadu — record lo employer ${promise.employerName}` });
  }
  const order: Record<Severity, number> = { critical: 0, high: 1, medium: 2 };
  return risks.sort((a, b) => order[a.severity] - order[b.severity]);
}

function sameCurrency(a?: string, b?: string) { return (a ?? 'INR') === (b ?? 'INR'); }
