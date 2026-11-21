// The harness pipeline for one transcript. Deterministic: same input, same output.
//
//   transcript ─► tokens ─► L2 lock (phones, money, hours, Gulf terms, names/places, jobs)
//              ─► L3 meaning (distress, self-correction) ─► L4 gate (read-back / escalate)
//              ─► corrected transcript + case slots
//
// Layers can be switched off for ablation. With everything off we get the "base" reading:
// the same Saathi extractor on the raw transcript, exact lexicon lookups only, no repair.

import { tokenize, joinSpelledLetters, type Token } from './tokens.ts';
import { PLACE_ALIASES } from './lexicon.te.ts'; // also extends the lexicon with Telugu-script entries
import { findPhones, findMoney, findHours } from './numbers.ts';
import { findNamesAndPlaces, type Target } from './phonetic.ts';
import { findGulfTerms, findDistress, findJobs, resolveSelfCorrections, findCodePhrase } from './terms.ts';
import { extractSlots } from './extract.ts';
import { PLACES } from './lexicon.ts';
import type { Entity, Revision, CallContext, CaseSlots } from './types.ts';

export interface HarnessLayers {
  context: boolean;      // L0: use caller context (names/places) as matching targets
  repair: boolean;       // L2: phonetic + ASR-variant repair (fuzzy). Off = exact lookups only
  corrections: boolean;  // L3: resolve "kadu kadu" self-corrections
}
export const ALL_ON: HarnessLayers = { context: true, repair: true, corrections: true };
export const ALL_OFF: HarnessLayers = { context: false, repair: false, corrections: false };

export interface ReadBack { reason: string; te: string; entity?: string }

export interface HarnessResult {
  input: string;
  corrected: string;
  tokens: Token[];
  entities: Entity[];
  revisions: Revision[];
  slots: CaseSlots;
  readBacks: ReadBack[];
  escalate: boolean;
  layers: HarnessLayers;
}

export function runHarness(text: string, ctx: CallContext = {}, layers: HarnessLayers = ALL_ON): HarnessResult {
  const tokens = joinSpelledLetters(tokenize(text));
  const consumed = new Set<number>();
  const claim = (es: Entity[]) => { for (const e of es) for (let k = e.start; k < e.end; k++) consumed.add(k); return es; };

  const entities: Entity[] = [];
  entities.push(...claim(findPhones(tokens, layers.repair)));
  entities.push(...claim(findHours(tokens, consumed)));
  entities.push(...claim(findMoney(tokens, consumed)));
  entities.push(...claim(findGulfTerms(tokens, consumed, layers.repair)));

  const targets: Target[] = [
    ...PLACES.map(p => ({ text: p, type: 'place' as const, fromContext: false })),
    ...Object.entries(PLACE_ALIASES).map(([alias, canonical]) => ({ text: alias, canonical, type: 'place' as const, fromContext: false })),
    ...(layers.context ? (ctx.places ?? []).map(p => ({ text: p, type: 'place' as const, fromContext: true })) : []),
    ...(layers.context ? (ctx.names ?? []).map(n => ({ text: n, type: 'name' as const, fromContext: true })) : []),
  ];
  entities.push(...claim(findNamesAndPlaces(tokens, consumed, targets, layers.repair)));
  entities.push(...claim(findJobs(tokens, consumed)));

  const distress = findDistress(tokens, layers.repair);
  const revisions = layers.corrections ? resolveSelfCorrections(tokens, entities) : [];
  entities.push(...distress);
  if (layers.context && ctx.codePhrase) entities.push(...findCodePhrase(tokens, tokenize(ctx.codePhrase).map(t => t.norm)));
  entities.sort((a, b) => a.start - b.start);

  const slots = extractSlots(tokens, entities);
  const { readBacks, escalate } = gate(entities, revisions, slots);
  return { input: text, corrected: rebuild(tokens, entities, layers), tokens, entities, revisions, slots, readBacks, escalate, layers };
}

/** L4: decide what must be confirmed with the caller, and what goes to a human. */
function gate(entities: Entity[], revisions: Revision[], slots: CaseSlots): { readBacks: ReadBack[]; escalate: boolean } {
  const readBacks: ReadBack[] = [];
  for (const e of entities) {
    if (e.superseded) continue;
    if (e.type === 'phone' && e.risky) readBacks.push({ reason: `Phone number incomplete (${(e.value as { issue?: string }).issue})`, te: `Number malli cheppandi — ${e.text} ani vinnanu, idi complete kaadu.`, entity: e.text });
    if ((e.type === 'place' || e.type === 'name') && e.risky) readBacks.push({ reason: `Low-confidence match: "${e.surface}" → ${e.text}`, te: `${e.text} ani annara?`, entity: e.text });
  }
  for (const r of revisions) {
    if (r.type === 'money') readBacks.push({ reason: `Amount corrected mid-sentence: ${r.from} → ${r.to}`, te: `${r.to} — idi correct-aa?`, entity: r.to });
  }
  // near-miss distress words ("korutunnaadu" for "kodutunnaadu"): ask, don't ignore
  for (const e of entities) {
    if (e.type === 'distress' && e.layer === 'L3-distress-fuzzy') readBacks.push({ reason: `Possible distress word: heard "${e.surface}" (≈ ${e.value})`, te: `"${e.surface}" ante — mimmalni ${e.value === 'violence' ? 'kodutunnaaraa' : 'emaina ibbandi pedutunnaaraa'}? Cheppandi.`, entity: e.surface });
  }
  const exactDistress = entities.some(e => e.type === 'distress' && e.layer === 'L3-distress' && !['passport_held', 'salary_unpaid'].includes(String(e.value)));
  const escalate = exactDistress || slots.huroob === true || slots.takenByStranger === true || slots.codePhrase === true;
  return { readBacks, escalate };
}

/** Rebuild the transcript with locked/repaired entities in canonical form. */
function rebuild(tokens: Token[], entities: Entity[], layers: HarnessLayers): string {
  const out: string[] = [];
  let i = 0;
  const byStart = new Map(entities.filter(e => e.type !== 'distress').map(e => [e.start, e]));
  while (i < tokens.length) {
    const e = byStart.get(i);
    if (e && e.end > i) {
      const show = e.changed && (layers.repair || e.layer === 'L2-money' || e.layer === 'L2-phone' || e.layer === 'L2-gulf');
      out.push(show ? e.text : tokens.slice(i, e.end).map(t => t.raw).join(' '));
      i = e.end;
    } else {
      out.push(tokens[i].raw);
      i++;
    }
  }
  return out.join(' ');
}

export type { Entity, Revision, CallContext, CaseSlots } from './types.ts';
