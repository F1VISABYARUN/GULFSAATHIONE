// Scoring the real Bolna calls against the fact sheet. Shared by the CLI and the server.

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { runHarness, ALL_OFF, ALL_ON } from '../../server/harness/index.ts';
import { assessRisks } from '../../server/risk/engine.ts';
import { slotErrors } from '../scorer.ts';
import { hasKey, transcribe, contextPrompt } from '../../server/stt/openai.ts';
import type { CallContext, CaseSlots } from '../../server/harness/types.ts';
import type { Call } from './build-calls.ts';
import { withQuestionContext, type Turn } from '../../server/harness/qa.ts';

export const BOLNA_DIR = dirname(fileURLToPath(import.meta.url));
const EVAL_DIR = dirname(BOLNA_DIR);

export interface FactEntry { status: 'unverified' | 'verified' | 'skip'; source: string; facts: Record<string, unknown>; risks: string[]; notes?: string }
export interface FactSheet { _how?: string; _fields?: string[]; calls: Record<string, FactEntry> }

export const loadCalls = (): Call[] => JSON.parse(readFileSync(join(BOLNA_DIR, 'calls.json'), 'utf8'));
export const loadFacts = (): FactSheet => JSON.parse(readFileSync(join(BOLNA_DIR, 'facts.json'), 'utf8'));
export const saveFacts = (f: FactSheet) => writeFileSync(join(BOLNA_DIR, 'facts.json'), JSON.stringify(f, null, 2));

// Agent-licence risks depend on the (fictional) sample agent list, so they are not scored on real calls.
const IGNORED_RISKS = new Set(['AGENT_FLAGGED', 'AGENT_NOT_IN_REGISTRY', 'AGENT_DISTRICT_MISMATCH']);

export function contextFor(call: Call): CallContext {
  if (call.agent === 'checkin') {
    // the promise record the check-in agent was given (from Bolna context_details)
    return { names: ['Mallaiah', 'AI NOOR CLEANING'], places: ['Dubai'], promise: { employerName: 'AI NOOR CLEANING', job: 'cleaner' }, codePhrase: 'అమ్మ బాగుందా' };
  }
  return {};
}

export const baseText = (turns: Turn[]) => turns.map(t => t.text).join(' . ');

export const harnessText = (turns: Turn[]) => withQuestionContext(turns);

/** Optional: re-transcribe the caller channel (left) with Telugu context hints. Cached. */
export async function hintedTranscript(call: Call): Promise<string | undefined> {
  const cache = join(EVAL_DIR, 'cache', 'bolna', `${call.id8}.hinted.json`);
  if (existsSync(cache)) return JSON.parse(readFileSync(cache, 'utf8')).text;
  const audio = join(EVAL_DIR, call.audio);
  if (!hasKey() || !existsSync(audio)) return undefined;
  const wav = execFileSync('ffmpeg', ['-v', 'error', '-i', audio, '-af', 'pan=mono|c0=c0', '-ar', '16000', '-f', 'wav', 'pipe:1'], { maxBuffer: 64 * 1024 * 1024 });
  const ctx = contextFor(call);
  const prompt = contextPrompt(ctx) + ' Places: Jagtial, Karimnagar, Nizamabad, Dubai, Oman, Qatar, Saudi.';
  const r = await transcribe(wav, 'caller.wav', prompt);
  mkdirSync(dirname(cache), { recursive: true });
  writeFileSync(cache, JSON.stringify(r, null, 2));
  return r.text;
}

export function scoreVariant(name: string, text: string, ctx: CallContext, layers: typeof ALL_ON, fact: FactEntry) {
  const h = runHarness(text, ctx, layers);
  const risks = assessRisks(h.slots, ctx.promise).map(r => r.id).filter(r => !IGNORED_RISKS.has(r));
  const expectedFacts = Object.fromEntries(Object.entries(fact.facts).filter(([, v]) => v !== null && v !== undefined)) as Partial<CaseSlots>;
  const expectedRisks = fact.risks.filter(r => !IGNORED_RISKS.has(r));
  const errs = slotErrors(expectedFacts, h.slots);
  return {
    name, slots: h.slots, risks, escalate: h.escalate, readBacks: h.readBacks.length,
    factsTotal: Object.keys(expectedFacts).length, factErrors: errs,
    caught: expectedRisks.filter(r => risks.includes(r)), missed: expectedRisks.filter(r => !risks.includes(r)),
    falseAlarms: risks.filter(r => !expectedRisks.includes(r)),
  };
}

export async function scoreCall(call: Call, fact: FactEntry, withStt = false) {
  const ctx = contextFor(call);
  const variants = [
    scoreVariant('bolna base', baseText(call.turns), ctx, ALL_OFF, fact),
    scoreVariant('base + harness', harnessText(call.turns), ctx, ALL_ON, fact),
  ];
  if (withStt) {
    const t = await hintedTranscript(call);
    if (t) variants.push(scoreVariant('re-STT + harness', t, ctx, ALL_ON, fact));
  }
  return { id8: call.id8, agent: call.agent, status: fact.status, variants };
}
