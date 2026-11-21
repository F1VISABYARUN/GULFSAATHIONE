// Storage for the new Gulf Saathi backend: workers, calls.
// Backends (picked automatically):
//  - Upstash Redis (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN, or Vercel KV's KV_REST_API_URL/TOKEN) — use on Vercel
//  - memory (STORE=memory) — tests / quick demos
//  - JSON file (default) — local machine / VM

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CaseSlots } from './harness/types.ts';

export interface WorkerRec {
  caseId: string;
  name?: string;
  phone: string;
  familyPhone?: string;
  district?: string;
  promise: CaseSlots;
  destCity?: string;
  destCountry?: string;
  codePhrase?: string;
  departedOn?: string;
  consent: boolean;
  status: 'registered' | 'abroad' | 'alert' | 'closed';
  riskLevel: 'ok' | 'medium' | 'high' | 'critical';
  reasons: string[];
  createdAt: string;
}
export interface CallRec { id: string; caseId: string; kind: string; at: string; status: string; transcript?: string; reasons: string[] }
interface Db { workers: WorkerRec[]; calls: CallRec[] }

const FILE = join(dirname(fileURLToPath(import.meta.url)), 'data', 'cases', 'saathi-db.json');
const KEY = 'gulf-saathi:db:v1';
let mem: Db | undefined;

function redisEnv() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : undefined;
}
export function backend(): 'redis' | 'memory' | 'file' {
  if (process.env.STORE === 'memory') return 'memory';
  if (redisEnv()) return 'redis';
  return process.env.VERCEL ? 'memory' : 'file';
}

async function load(): Promise<Db> {
  const b = backend();
  if (b === 'memory') return (mem ??= { workers: [], calls: [] });
  if (b === 'redis') {
    const { url, token } = redisEnv()!;
    const r = await fetch(`${url}/get/${encodeURIComponent(KEY)}`, { headers: { authorization: `Bearer ${token}` } });
    const j: any = await r.json();
    return j.result ? JSON.parse(j.result) : { workers: [], calls: [] };
  }
  return existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : { workers: [], calls: [] };
}
async function save(db: Db) {
  const b = backend();
  if (b === 'memory') { mem = db; return; }
  if (b === 'redis') {
    const { url, token } = redisEnv()!;
    await fetch(`${url}/set/${encodeURIComponent(KEY)}`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify(db) });
    return;
  }
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(db, null, 2));
}

// Small single-document store: fine for a pilot (hundreds of workers). Move to Postgres beyond that.
export const store = {
  async addWorker(w: Omit<WorkerRec, 'status' | 'riskLevel' | 'reasons' | 'createdAt'>): Promise<WorkerRec> {
    const db = await load();
    const rec: WorkerRec = { ...w, status: 'registered', riskLevel: 'ok', reasons: [], createdAt: new Date().toISOString() };
    db.workers = [...db.workers.filter(x => x.caseId !== w.caseId), rec];
    await save(db);
    return rec;
  },
  async worker(caseId: string) { return (await load()).workers.find(w => w.caseId === caseId); },
  async workers() { return (await load()).workers; },
  async updateWorker(caseId: string, patch: Partial<WorkerRec>) {
    const db = await load();
    const w = db.workers.find(x => x.caseId === caseId);
    if (w) Object.assign(w, patch);
    await save(db);
    return w;
  },
  async addCall(c: CallRec) { const db = await load(); db.calls.push(c); await save(db); return c; },
  async calls(caseId?: string) { return (await load()).calls.filter(c => !caseId || c.caseId === caseId); },
  async reset() { await save({ workers: [], calls: [] }); },
};

export function newCaseId(): string {
  const a = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return 'GS-' + Array.from({ length: 6 }, () => a[Math.floor(Math.random() * a.length)]).join('');
}
