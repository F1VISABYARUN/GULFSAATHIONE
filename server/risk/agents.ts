// Recruiting-agent check against MEA's official list of registered RAs (as on 08-04-2026).
// Source: https://www.mea.gov.in/images/pdf/03-Active-RA-List-21-04-2026.pdf, parsed by scripts/parse_ra_list.py.
// Workers usually name a PERSON ("agent Ramesh"), while the list holds AGENCIES — so "not found" means
// "ask for the RC licence number", never "this agent is illegal".

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadNotified } from './notified.ts';
import { similarity } from '../harness/phonetic.ts';

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');

export interface RA { raId: string; name: string; state: string; district: string; rc: string | null; status: string; website: string | null }
export interface AgentCheck { status: 'registered' | 'registered_other_district' | 'not_found' | 'flagged'; match?: RA; flaggedName?: string; source: string; notifiedRegister: 'unavailable' | 'needs_district' | 'exact_match' | 'no_exact_match' }

let cache: { ras: RA[]; notified: ReturnType<typeof loadNotified> } | undefined;
function load() {
  if (cache) return cache;
  const raPath = join(DATA, 'ra_list.json');
  const ras: RA[] = existsSync(raPath) ? [...JSON.parse(readFileSync(raPath, 'utf8')).agents, ...JSON.parse(readFileSync(raPath, 'utf8')).state_agents] : [];
  const notified = loadNotified(process.env.EMIGRATE_NOTIFIED_FILE);
  return (cache = {ras, notified});
}

const STOP = /\b(m\/s|ms|pvt|private|ltd|limited|the|and|&|co|company|consultancy|consultants|consultant|manpower|man power|services|international|overseas|recruiting|recruitment|travels|tours|enterprises|agency|hr|human resources)\b/gi;
const core = (s: string) => s.toLowerCase().replace(STOP, ' ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

export function raCount() { return load().ras.length; }

export function checkAgent(name: string, district?: string, raId?: string): AgentCheck {
  const { ras, notified } = load();
  const source = 'MEA list of active RAs, as on 08-04-2026';
  const coverage: Pick<AgentCheck, 'source' | 'notifiedRegister'> = {
    source, notifiedRegister: !notified ? 'unavailable' : district?.trim() ? 'no_exact_match' : 'needs_district',
  };
  const norm = (v: string) => v.normalize('NFC').trim().replace(/\s+/g,' ').toLowerCase();
  const flag = district && notified?.agents.find(a => norm(a.name) === norm(name) && norm(a.district) === norm(district));
  if (flag && notified) return { status:'flagged', flaggedName:flag.name, notifiedRegister:'exact_match', source:notified.source + ' as of ' + notified.asOf };
  if (raId) {
    const id = norm(raId);
    const m = ras.find(r => norm(r.raId) === id || (r.rc && norm(r.rc) === id));
    if (!m || m.status !== 'Active') return { status: 'not_found', ...coverage };
    return { status: 'registered', match: m, ...coverage };
  }
  const q = core(name);
  if (q.length < 3) return { status: 'not_found', ...coverage };
  let best: { r: RA; s: number } | undefined;
  for (const r of ras) {
    const c = core(r.name);
    if (!c) continue;
    const s = c === q ? 1 : similarity(c, q);
    if (s >= 0.86 && (!best || s > best.s)) best = { r, s };
  }
  if (!best) return { status: 'not_found', ...coverage };
  const sameDistrict = !district || !best.r.district || best.r.district.toLowerCase().includes(district.toLowerCase());
  return { status: sameDistrict ? 'registered' : 'registered_other_district', match: best.r, ...coverage };
}

export function listAgents(district?: string, state = 'Telangana'): RA[] {
  return load().ras.filter(r => r.state.toLowerCase() === state.toLowerCase() && (!district || r.district.toLowerCase().includes(district.toLowerCase())));
}
