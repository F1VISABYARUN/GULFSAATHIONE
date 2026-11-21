// "Silence is a signal": a worker who stops answering check-ins is itself a risk.
// Najeeb's family heard nothing for years. Saathi registers each worker with a promise record and a
// check-in schedule; every call (Bolna webhook) updates last contact; overdue workers escalate.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CaseSlots } from './harness/types.ts';

const FILE = join(dirname(fileURLToPath(import.meta.url)), 'data', 'cases', 'workers.json');

export interface Worker {
  caseId: string;
  name?: string;
  district?: string;
  promise?: CaseSlots;
  departedOn?: string;            // ISO date
  arrivalDueBy?: string;          // ISO datetime: arrival check-in must happen by then (first 48 h)
  everyDays: number;              // weekly = 7
  lastContact?: string;           // ISO datetime of the last answered call
  missedAttempts: number;         // unanswered call attempts since last contact
}

export interface SilenceStatus { caseId: string; name?: string; state: 'ok' | 'due' | 'overdue' | 'escalate'; reason: string; hoursSilent?: number }

const load = (): Worker[] => (existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : []);
const save = (w: Worker[]) => { mkdirSync(dirname(FILE), { recursive: true }); writeFileSync(FILE, JSON.stringify(w, null, 2)); };

export function registerWorker(w: Partial<Worker> & { caseId: string }): Worker {
  const all = load().filter(x => x.caseId !== w.caseId);
  const departed = w.departedOn ? new Date(w.departedOn) : undefined;
  const worker: Worker = {
    everyDays: 7, missedAttempts: 0, ...w,
    arrivalDueBy: w.arrivalDueBy ?? (departed ? new Date(departed.getTime() + 48 * 3600_000).toISOString() : undefined),
  };
  save([...all, worker]);
  return worker;
}

/** Record a call attempt: answered (with speech) resets the clock; unanswered counts as a miss. */
export function recordAttempt(caseId: string, answered: boolean, at = new Date()): Worker | undefined {
  const all = load();
  const w = all.find(x => x.caseId === caseId);
  if (!w) return undefined;
  if (answered) { w.lastContact = at.toISOString(); w.missedAttempts = 0; } else w.missedAttempts += 1;
  save(all);
  return w;
}

/** Pure function so it can be unit-tested with a fixed clock. */
export function silenceStatus(w: Worker, now = new Date()): SilenceStatus {
  const base = { caseId: w.caseId, name: w.name };
  const last = w.lastContact ? new Date(w.lastContact) : undefined;
  const hours = (d: Date) => Math.round((now.getTime() - d.getTime()) / 3600_000);
  // First 48 hours after departure: the most dangerous window (airport pickup)
  if (w.arrivalDueBy && (!last || (w.departedOn && last < new Date(w.departedOn)))) {
    const due = new Date(w.arrivalDueBy);
    if (now > due) return { ...base, state: 'escalate', reason: 'No arrival check-in within 48 hours of departure', hoursSilent: w.departedOn ? hours(new Date(w.departedOn)) : undefined };
    return { ...base, state: 'due', reason: 'Arrival check-in pending' };
  }
  if (!last) return { ...base, state: 'due', reason: 'No contact recorded yet' };
  const silent = hours(last);
  const period = w.everyDays * 24;
  if (w.missedAttempts >= 3 || silent > period * 2) return { ...base, state: 'escalate', reason: `Silent ${Math.round(silent / 24)} days, ${w.missedAttempts} missed attempts`, hoursSilent: silent };
  if (silent > period) return { ...base, state: 'overdue', reason: `Check-in overdue (${Math.round(silent / 24)} days)`, hoursSilent: silent };
  return { ...base, state: 'ok', reason: 'In contact', hoursSilent: silent };
}

export const listWorkers = () => load();
