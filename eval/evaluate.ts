// Shared evaluation logic: used by the CLI runner and by the server.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runHarness, ALL_OFF, ALL_ON, type HarnessLayers } from '../server/harness/index.ts';
import { assessRisks } from '../server/risk/engine.ts';
import { transcribe, contextPrompt, llmExtract, hasKey } from '../server/stt/openai.ts';
import { wer, criticalTermHits, slotErrors, riskScore } from './scorer.ts';
import type { CallContext, CaseSlots } from '../server/harness/types.ts';

export const EVAL_DIR = dirname(fileURLToPath(import.meta.url));

export interface Clip {
  id: string;
  title: string;
  split: 'dev' | 'test';
  audio?: string;                       // path relative to eval/
  reference: string;                    // human-written exact transcript (romanized)
  context?: CallContext & { promiseFrom?: string };
  expected: { criticalTerms: string[]; slots: Partial<CaseSlots>; risks: string[] };
}

export function loadDataset(): Clip[] {
  return JSON.parse(readFileSync(join(EVAL_DIR, 'dataset.json'), 'utf8')).clips;
}

function cached<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const p = join(EVAL_DIR, 'cache', name);
  if (existsSync(p)) return Promise.resolve(JSON.parse(readFileSync(p, 'utf8')));
  return fn().then(v => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, JSON.stringify(v, null, 2)); return v; });
}

export interface Transcripts { base: string; hinted: string; source: 'stt' | 'cache' | 'reference' }

/** Get base (no hints) and hinted (L0 context prompt) transcripts for a clip. */
export async function getTranscripts(clip: Clip, mode: 'audio' | 'reference'): Promise<Transcripts | undefined> {
  if (mode === 'reference') return { base: clip.reference, hinted: clip.reference, source: 'reference' };
  const basePath = join(EVAL_DIR, 'cache', `${clip.id}.base.json`);
  const audioPath = clip.audio ? join(EVAL_DIR, clip.audio) : undefined;
  const haveAudio = !!audioPath && existsSync(audioPath);
  if (!haveAudio && !existsSync(basePath)) return undefined;
  if (haveAudio && !hasKey() && !existsSync(basePath)) return undefined;
  const fromCache = existsSync(basePath);
  const load = () => readFileSync(audioPath!);
  const name = `audio${extname(audioPath ?? '.wav')}`;
  const base = await cached(`${clip.id}.base.json`, () => transcribe(load(), name));
  const hinted = await cached(`${clip.id}.hinted.json`, () => transcribe(load(), name, contextPrompt(clip.context ?? {})));
  return { base: base.text, hinted: hinted.text, source: fromCache ? 'cache' : 'stt' };
}

export interface Variant { name: string; transcript: string; output: string; slots: CaseSlots; risks: string[]; riskDetails: ReturnType<typeof assessRisks>; termAcc: number; termMiss: string[]; slotErrors: ReturnType<typeof slotErrors>; caught: string[]; missed: string[]; falseAlarms: string[]; wer: number }

export async function evaluateClip(clip: Clip, tx: Transcripts, promise?: CaseSlots, withLlm = hasKey()) {
  const ctx = clip.context ?? {};
  const score = (name: string, transcript: string, output: string, slots: CaseSlots): Variant => {
    const riskDetails = assessRisks(slots, promise);
    const risks = riskDetails.map(r => r.id);
    const terms = criticalTermHits(clip.expected.criticalTerms, output);
    const rs = riskScore(clip.expected.risks, risks);
    return {
      name, transcript, output, slots, risks, riskDetails,
      termAcc: clip.expected.criticalTerms.length ? terms.hit.length / clip.expected.criticalTerms.length : 1,
      termMiss: terms.miss, slotErrors: slotErrors(clip.expected.slots, slots),
      caught: rs.caught, missed: rs.missed, falseAlarms: rs.falseAlarms,
      // WER measures the STT words (L0 effect); canonical numbers like ₹1,50,000 would otherwise count as errors
      wer: wer(clip.reference, transcript),
    };
  };
  const run = (t: string, layers: HarnessLayers) => runHarness(t, ctx, layers);

  const variants: Variant[] = [];
  const base = run(tx.base, ALL_OFF);
  variants.push(score('base', tx.base, tx.base, base.slots));
  if (withLlm) {
    const slots = await cached(`${clip.id}.${tx.source === 'reference' ? 'ref' : 'base'}.llm.json`, () => llmExtract(tx.base));
    variants.push(score('base+llm', tx.base, tx.base, slots));
  }
  const l0 = run(tx.hinted, { context: true, repair: false, corrections: false });
  variants.push(score('+L0 context', tx.hinted, tx.hinted, l0.slots));
  const l2 = run(tx.hinted, { context: true, repair: true, corrections: false });
  variants.push(score('+L2 repair', tx.hinted, l2.corrected, l2.slots));
  const full = run(tx.hinted, ALL_ON);
  variants.push(score('harness', tx.hinted, full.corrected, full.slots));
  return { id: clip.id, title: clip.title, split: clip.split, reference: clip.reference, source: tx.source, variants, harness: full };
}

export function promiseFor(clip: Clip, all: Clip[]): CaseSlots | undefined {
  if (clip.context?.promise) return clip.context.promise;
  const from = clip.context?.promiseFrom && all.find(c => c.id === clip.context!.promiseFrom);
  return from ? (from.expected.slots as CaseSlots) : undefined;
}

export { ALL_ON };
