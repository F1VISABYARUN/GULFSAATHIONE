// Official mandal gazetteer (server/data/research/mandals.json, from district websites, checked 2026-11-21).
// Gives the matcher every mandal + spelling variants + Telugu names, and maps mandal -> district.

import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { toLatin } from './translit.ts';
import type { Target } from './phonetic.ts';

interface Mandal { name: string; te?: string | null; aliases?: string[] }
interface District { district: string; district_te?: string | null; district_aliases?: string[]; mandals: Mandal[] }

const path = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'research', 'mandals.json');
const districts: District[] = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')).districts : [];

export const MANDAL_DISTRICTS = new Map<string, string[]>();
export const DISTRICT_NAMES = new Set<string>();
const districtTargets: Target[] = [];
const mandalTargets: Target[] = [];
const districtWords = new Set<string>();

for (const d of districts) {
  DISTRICT_NAMES.add(d.district);
  for (const t of [d.district, ...(d.district_aliases ?? []), ...(d.district_te ? [toLatin(d.district_te)] : [])]) {
    districtWords.add(t.toLowerCase().replace(/\s+/g, ''));
    districtTargets.push({ text: t, canonical: d.district, type: 'place', fromContext: false });
  }
}
for (const d of districts) {
  for (const m of d.mandals) {
    MANDAL_DISTRICTS.set(m.name, [...(MANDAL_DISTRICTS.get(m.name) ?? []), d.district]);
    for (const t of [m.name, ...(m.aliases ?? []), ...(m.te ? [toLatin(m.te)] : [])]) {
      if (districtWords.has(t.toLowerCase().replace(/\s+/g, ''))) continue; // "Jagtial" is the district, not "Jagtial Urban"
      mandalTargets.push({ text: t, canonical: m.name, type: 'place', fromContext: false });
    }
  }
}

/** Districts first: on an exact tie the district wins. */
export const GAZETTEER_TARGETS: Target[] = [...districtTargets, ...mandalTargets];

export function districtOf(place: string): { district?: string; ambiguous?: string[] } {
  if (DISTRICT_NAMES.has(place)) return { district: place };
  const ds = [...new Set(MANDAL_DISTRICTS.get(place) ?? [])];
  if (ds.length === 1) return { district: ds[0] };
  if (ds.length > 1) return { ambiguous: ds };
  return {};
}
