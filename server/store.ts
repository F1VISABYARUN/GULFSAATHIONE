// Storage for the new Gulf Saathi backend: workers, calls.
// Backends (picked automatically):
//  - Upstash Redis (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN, or Vercel KV's KV_REST_API_URL/TOKEN) — use on Vercel
//  - memory (STORE=memory) — tests / quick demos
//  - JSON file (default) — local machine / VM

import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CaseSlots } from './harness/types.ts';

export interface WorkerRec {
  caseId: string;
  name?: string;
  phone: string;
  notes?: { at: string; text: string; source?: 'caseworker' | 'system' }[];
  acknowledged?: { by: string; at: string };
  outcome?: 'solved' | 'partly' | 'not' | 'withdrawn';
  closedAt?: string;
  alertSince?: string;
  translations?: import("./translations.ts").Translation[];
  familyPhone?: string;
  familySms?: import('./family-sms.ts').SmsRecord;
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
export interface CallRec { id: string; caseId: string; kind: string; at: string; status: string; transcript?: string; reasons: string[]; needsConfirmation?: 'salary_received'[]; salaryExchange?: { q: string; text: string } }
interface Db { workers: WorkerRec[]; calls: CallRec[]; requests?: { key: string; at: number }[] }

const DEFAULT_FILE = join(dirname(fileURLToPath(import.meta.url)), 'data', 'cases', 'saathi-db.json');
const KEY = 'gulf-saathi:db:v1';
let mem: Db | undefined;

function redisEnv() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : undefined;
}
export function backend(): 'redis' | 'memory' | 'file' {
  if (process.env.VERCEL) {
    if (redisEnv()) return 'redis';
    throw Object.assign(new Error('Durable case storage is not configured'), { status: 503 });
  }
  if (process.env.STORE === 'memory') return 'memory';
  if (redisEnv()) return 'redis';
  return 'file';
}

async function load(): Promise<Db> {
  const b = backend();
  if (b === 'memory') return (mem ??= { workers: [], calls: [] });
  if (b === 'redis') {
    const { url, token } = redisEnv()!;
    const r = await fetch(`${url}/get/${encodeURIComponent(KEY)}`, { headers: { authorization: `Bearer ${token}` } });
    const j: any = await r.json();
    if (!r.ok || j.error) throw Error('Redis read failed');
    return j.result ? JSON.parse(j.result) : { workers: [], calls: [] };
  }
  const FILE = process.env.SAATHI_CASE_FILE || DEFAULT_FILE;
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
  const FILE = process.env.SAATHI_CASE_FILE || DEFAULT_FILE;
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE + ".tmp", JSON.stringify(db, null, 2), { mode: 0o600 });
  renameSync(FILE + ".tmp", FILE);
}

// Optimistic compare-and-set across Redis clients. Serialize local memory/file writers.
let pending = Promise.resolve();
async function mutate<T>(edit: (db: Db) => T): Promise<T> {
  if (backend() === 'redis') {
    const { url, token } = redisEnv()!;
    const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
    async function command(args: unknown[]) {
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(args) });
      const data = await res.json();
      if (!res.ok || data.error) throw Error('Redis mutation failed');
      return data.result;
    }
    for (let i = 0; i < 16; i++) {
      const before = await command(['GET', KEY]);
      const db: Db = before ? JSON.parse(before) : { workers: [], calls: [] };
      const value = edit(db);
      const script = "if (redis.call('GET',KEYS[1]) or '') == ARGV[1] then redis.call('SET',KEYS[1],ARGV[2]); return 1 end return 0";
      if (await command(['EVAL', script, 1, KEY, before ?? '', JSON.stringify(db)])) return value;
    }
    throw Error('Worker store busy');
  }
  const task = pending.then(async () => {
    const db = await load();
    const value = edit(db);
    await save(db);
    return value;
  });
  pending = task.then(() => {}, () => {});
  return task;
}

export const store = {
  async addWorker(w: Omit<WorkerRec, 'status' | 'riskLevel' | 'reasons' | 'createdAt'>): Promise<WorkerRec> {
    return mutate(db => {
      const existing = db.workers.find(x => x.caseId === w.caseId);
      if (existing) return existing;
      const rec: WorkerRec = { ...w, status: 'registered', riskLevel: 'ok', reasons: [], createdAt: new Date().toISOString() };
      db.workers.push(rec);
      return rec;
    });
  },
  /** Records one use of `key` and returns true if fewer than `max` happened in the last `windowMs`; otherwise records nothing and returns false. */
  async allow(key: string, windowMs: number, max: number): Promise<boolean> {
    return mutate(db => {
      const now = Date.now();
      db.requests = (db.requests ?? []).filter(r => now - r.at < 86_400_000);
      if (db.requests.filter(r => r.key === key && now - r.at < windowMs).length >= max) return false;
      db.requests.push({ key, at: now });
      return true;
    });
  },
  async worker(caseId: string) { return (await load()).workers.find(w => w.caseId === caseId); },
  async workers() { return (await load()).workers; },
  async change<T>(caseId: string, edit: (w: WorkerRec) => T) {
    return mutate(db => {
      const w = db.workers.find(x => x.caseId === caseId);
      return w ? edit(w) : undefined;
    });
  },
  async updateWorker(caseId: string, patch: Partial<WorkerRec>) {
    return this.change(caseId, w => Object.assign(w, patch));
  },
  async recordAlertCall<T>(call: CallRec, edit: (w: WorkerRec) => T) {
    return mutate(db => {
      const worker = db.workers.find(w => w.caseId === call.caseId);
      if (!worker) throw new Error('Case not found');
      if (db.calls.some(c => c.caseId === call.caseId && c.id === call.id && c.status === call.status)) return;
      db.calls.push(call);
      return edit(worker);
    });
  },
  async addCall(c: CallRec) { return mutate(db => { db.calls.push(c); return c; }); },
  async calls(caseId?: string) { return (await load()).calls.filter(c => !caseId || c.caseId === caseId); },
  async reset() { await mutate(db => { db.workers = []; db.calls = []; db.requests = []; }); },
};

export function newCaseId(): string {
  const a = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return 'GS-' + Array.from({ length: 6 }, () => a[Math.floor(Math.random() * a.length)]).join('');
}
