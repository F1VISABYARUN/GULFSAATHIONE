// What government and public data the service uses, why, and how current it is. Counts and dates are read from the data files themselves,
// so the website's data page cannot drift from what the code actually holds.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Express } from 'express';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'data');
const read = (file: string) => JSON.parse(readFileSync(join(dir, file), 'utf8'));

function confirmedFigures(node: unknown): { total: number; confirmed: number } {
  if (Array.isArray(node)) return node.reduce((a, v) => { const r = confirmedFigures(v); return { total: a.total + r.total, confirmed: a.confirmed + r.confirmed }; }, { total: 0, confirmed: 0 });
  if (node && typeof node === 'object') {
    const o = node as Record<string, unknown>;
    const own = typeof o.status === 'string' ? { total: 1, confirmed: o.status === 'confirmed' ? 1 : 0 } : { total: 0, confirmed: 0 };
    return Object.values(o).reduce<{ total: number; confirmed: number }>((a, v) => { const r = confirmedFigures(v); return { total: a.total + r.total, confirmed: a.confirmed + r.confirmed }; }, own);
  }
  return { total: 0, confirmed: 0 };
}

export function dataSources() {
  const ra = read('ra_list.json'), rules = read('rules.json'), missions = read('missions.json'), exit = read('exit_rules.json');
  const mandals = read('research/mandals.json'), helplines = read('research/helplines.json');
  const figures = confirmedFigures(exit.countries);
  return [
    { id: 'ra_list', kind: 'government', title: 'Registered recruiting agents (MEA)', sources: [ra.source_url, ra.state_source_url],
      asOf: ra.retrieved_on, listDate: ra.source, count: ra.agents.length + ra.state_agents.length,
      limits: 'Read automatically from a PDF, so a name can contain a reading mistake. A name missing from this list does not prove an agent is illegal: check on emigrate.gov.in.' },
    { id: 'fee_cap', kind: 'government', title: 'Recruitment fee limit', sources: ['https://emigrate.gov.in/'], asOf: null,
      value: `₹${rules.feeCapINR.toLocaleString('en-IN')} + ${Math.round(rules.gstRate * 100)}% GST`, limits: rules._note },
    { id: 'missions', kind: 'government', title: 'Indian embassy and consulate contacts', sources: [...new Set<string>(missions.map((m: { source_url: string }) => m.source_url))],
      count: missions.length, places: missions.map((m: { city: string }) => m.city), limits: 'Numbers change. Always confirm on the embassy website.' },
    { id: 'exit_rules', kind: 'government', title: 'Visa-ending and overstay rules (UAE fines and extension fees)', asOf: exit.asof,
      sources: ['https://icp.gov.ae/', 'https://www.indembassyuae.gov.in/'], countriesWithFigures: Object.keys(exit.countries).filter(c => confirmedFigures(exit.countries[c]).confirmed > 0),
      countriesEmbassyLineOnly: Object.keys(exit.countries).filter(c => confirmedFigures(exit.countries[c]).confirmed === 0),
      confirmedFigures: figures.confirmed, listedFigures: figures.total, notVerified: exit.not_verified.length,
      limits: 'Only figures read on an official page are ever spoken. Everything else is listed as not verified and the caller is sent to the embassy.' },
    { id: 'districts', kind: 'public', title: 'Telangana districts and mandals', asOf: mandals.verified_on, count: mandals.districts.length,
      names: mandals.districts.map((d: { district: string }) => d.district), mandals: mandals.districts.reduce((n: number, d: { mandals: unknown[] }) => n + d.mandals.length, 0),
      sources: [...new Set<string>(mandals.districts.map((d: { source_url: string }) => d.source_url).filter(Boolean))],
      limits: 'Covers only these districts so far, not all of Telangana. Used to understand place names a caller says and to route a case to a district team.' },
    { id: 'helplines', kind: 'public', title: 'Helpline and welfare contacts', count: helplines.length, limits: 'Contacts are checked when added; confirm before relying on one.' },
  ];
}

export function registerDataSources(app: Express) {
  app.get('/api/data-sources', (_req, res) => { res.set('Cache-Control', 'public, max-age=300'); res.json({ sources: dataSources() }); });
}
