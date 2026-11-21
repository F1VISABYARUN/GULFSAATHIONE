// Storage for the new Gulf Saathi backend: workers, calls, cases.
// Default: JSON file (local / VM). On Vercel the filesystem is read-only, so set STORE=memory for demos
// and swap in a real database later (the interface is small on purpose).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CaseSlots } from './harness/types.ts';

export interface WorkerRec {
  caseId: string;
  name?: string;
  phone: string;                     // E.164, the number Saathi calls
  familyPhone?: string;
  district?: string;
  promise: CaseSlots;                // employerName, job, salary, hours, visaType, feeINR, agentName ...
  destCity?: string;
  destCountry?: string;
  codePhrase?: string;
  departedOn?: string;               // ISO date of flight
  consent: boolean;
  status: 'registered' | 'abroad' | 'alert' | 'closed';
  riskLevel: 'ok' | 'medium' | 'high' | 'critical';
  reasons: string[];
  createdAt: string;
}
export interface CallRec { id: string; caseId: string; kind: string; at: string; status: string; transcript?: string; reasons: string[] }

interface Db { workers: WorkerRec[]; calls: CallRec[] }

const FILE = join(dirname(fileURLToPath(import.meta.url)), 'data', 'cases', 'saathi-db.json');
let mem: Db | undefined;

function load(): Db {
  if (process.env.STORE === 'memory') return (mem ??= { workers: [], calls: [] });
  return existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : { workers: [], calls: [] };
}
function save(db: Db) {
  if (process.env.STORE === 'memory') { mem = db; return; }
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(db, null, 2));
}

export const store = {
  addWorker(w: Omit<WorkerRec, 'status' | 'riskLevel' | 'reasons' | 'createdAt'>): WorkerRec {
    const db = load();
    const rec: WorkerRec = { ...w, status: 'registered', riskLevel: 'ok', reasons: [], createdAt: new Date().toISOString() };
    db.workers = [...db.workers.filter(x => x.caseId !== w.caseId), rec];
    save(db);
    return rec;
  },
  worker(caseId: string) { return load().workers.find(w => w.caseId === caseId); },
  workers() { return load().workers; },
  updateWorker(caseId: string, patch: Partial<WorkerRec>) {
    const db = load();
    const w = db.workers.find(x => x.caseId === caseId);
    if (w) Object.assign(w, patch);
    save(db);
    return w;
  },
  addCall(c: CallRec) { const db = load(); db.calls.push(c); save(db); return c; },
  calls(caseId?: string) { return load().calls.filter(c => !caseId || c.caseId === caseId); },
  reset() { save({ workers: [], calls: [] }); },
};

export function newCaseId(): string {
  const a = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return 'GS-' + Array.from({ length: 6 }, () => a[Math.floor(Math.random() * a.length)]).join('');
}
