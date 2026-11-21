// Recruiting-agent check against MEA's official list of registered RAs (as on 08-04-2026).
// Source: https://www.mea.gov.in/images/pdf/03-Active-RA-List-21-04-2026.pdf, parsed by scripts/parse_ra_list.py.
// Workers usually name a PERSON ("agent Ramesh"), while the list holds AGENCIES — so "not found" means
// "ask for the RC licence number", never "this agent is illegal".

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { similarity } from '../harness/phonetic.ts';

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');

export interface RA { raId: string; name: string; state: string; district: string; rc: string | null; status: string; website: string | null }
export interface AgentCheck { status: 'registered' | 'registered_other_district' | 'not_found' | 'flagged'; match?: RA; flaggedName?: string; source: string }

let cache: { ras: RA[]; flagged: string[] } | undefined;
function load() {
  if (cache) return cache;
  const raPath = join(DATA, 'ra_list.json');
  const ras: RA[] = existsSync(raPath) ? [...JSON.parse(readFileSync(raPath, 'utf8')).agents, ...JSON.parse(readFileSync(raPath, 'utf8')).state_agents] : [];
  // demo-only flagged names (fictional) — the real eMigrate unregistered-agent list is not machine-readable yet
  const demoPath = join(DATA, 'agents.sample.json');
  const flagged: string[] = existsSync(demoPath) ? JSON.parse(readFileSync(demoPath, 'utf8')).flagged ?? [] : [];
  return (cache = { ras, flagged });
}

const STOP = /\b(m\/s|ms|pvt|private|ltd|limited|the|and|&|co|company|consultancy|consultants|consultant|manpower|man power|services|international|overseas|recruiting|recruitment|travels|tours|enterprises|agency|hr|human resources)\b/gi;
const core = (s: string) => s.toLowerCase().replace(STOP, ' ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

export function raCount() { return load().ras.length; }

export function checkAgent(name: string, district?: string, raId?: string): AgentCheck {
  const { ras, flagged } = load();
  const source = 'MEA list of active RAs, as on 08-04-2026';
  const flag = flagged.find(f => similarity(f, name) >= 0.85);
  if (flag) return { status: 'flagged', flaggedName: flag, source: 'demo flagged list (fictional)' };
  if (raId) {
    const m = ras.find(r => r.raId.toLowerCase() === raId.toLowerCase());
    if (m) return { status: m.status === 'Active' ? 'registered' : 'not_found', match: m, source };
  }
  const q = core(name);
  if (q.length < 3) return { status: 'not_found', source };
  let best: { r: RA; s: number } | undefined;
  for (const r of ras) {
    const c = core(r.name);
    if (!c) continue;
    const s = c === q ? 1 : similarity(c, q);
    if (s >= 0.86 && (!best || s > best.s)) best = { r, s };
  }
  if (!best) return { status: 'not_found', source };
  const sameDistrict = !district || !best.r.district || best.r.district.toLowerCase().includes(district.toLowerCase());
  return { status: sameDistrict ? 'registered' : 'registered_other_district', match: best.r, source };
}

export function listAgents(district?: string, state = 'Telangana'): RA[] {
  return load().ras.filter(r => r.state.toLowerCase() === state.toLowerCase() && (!district || r.district.toLowerCase().includes(district.toLowerCase())));
}
