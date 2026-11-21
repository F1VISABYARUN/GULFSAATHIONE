// OpenAI calls: speech-to-text (base vs context-hinted), romanization, and the LLM baseline extractor.
// Model names are env-configurable — verify current names/params in the OpenAI docs.

import OpenAI, { toFile } from 'openai';
import type { CallContext, CaseSlots } from '../harness/types.ts';
import { GULF_TERMS } from '../harness/lexicon.ts';

export const hasKey = () => Boolean(process.env.OPENAI_API_KEY);
let client: OpenAI | undefined;
const ai = () => (client ??= new OpenAI());
const STT_MODEL = () => process.env.OPENAI_STT_MODEL || 'gpt-4o-transcribe';
const TEXT_MODEL = () => process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini';

export interface SttResult { text: string; model: string; prompt?: string; avgLogprob?: number }

/** L0: build the hint prompt from what we already know about this caller. */
export function contextPrompt(ctx: CallContext): string {
  const names = (ctx.names ?? []).join(', ');
  const places = (ctx.places ?? []).join(', ');
  const terms = GULF_TERMS.map(t => t.canonical).join(', ');
  return [
    'Phone call in Telugu mixed with English, from a Telangana worker going to or working in the Gulf.',
    'Write Telugu words in Roman letters (Tenglish), keep English words in English, write numbers as spoken words.',
    names && `People: ${names}.`,
    places && `Places: ${places}.`,
    `Terms: ${terms}, laksha, velu, dirhams, riyals, jeetham.`,
  ].filter(Boolean).join(' ');
}

export async function transcribe(audio: Buffer, filename: string, prompt?: string): Promise<SttResult> {
  const file = await toFile(audio, filename);
  const model = STT_MODEL();
  const wantsLogprobs = model.startsWith('gpt-4o');
  const res: any = await ai().audio.transcriptions.create({
    file, model, response_format: 'json',
    ...(prompt ? { prompt } : {}),
    ...(wantsLogprobs ? { include: ['logprobs'] } : {}),
  } as any);
  const lps: number[] = (res.logprobs ?? []).map((l: any) => l.logprob).filter((n: unknown) => typeof n === 'number');
  const avgLogprob = lps.length ? lps.reduce((a, b) => a + b, 0) / lps.length : undefined;
  let text: string = res.text ?? '';
  if (/[ఀ-౿]/.test(text)) text = await romanize(text);
  return { text, model, prompt, avgLogprob };
}

/**
 * If STT returns Telugu script, convert to Roman letters so both sides are scored the same way.
 * Applied identically to base and harness transcripts.
 */
export async function romanize(text: string): Promise<string> {
  const r = await ai().chat.completions.create({
    model: TEXT_MODEL(), temperature: 0,
    messages: [
      { role: 'system', content: 'Transliterate Telugu script into Roman letters (Tenglish) exactly as pronounced. Do not translate, fix, or add words. Keep English words and digits unchanged. Output only the text.' },
      { role: 'user', content: text },
    ],
  });
  return r.choices[0]?.message?.content?.trim() ?? text;
}

/** The fair baseline: raw transcript + a capable LLM extracting the same fields. */
export async function llmExtract(transcript: string): Promise<CaseSlots> {
  const r = await ai().chat.completions.create({
    model: TEXT_MODEL(), temperature: 0, response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: `Extract facts from a Telugu-English call transcript of a Gulf migrant worker. Return JSON with any of these keys you can find:
agentName (string), employerName (string), pickupName (string), feeINR (number, rupees paid to agent), visaType ("work"|"visit"),
passportType ("ECR"|"ECNR"), salary ({amount:number, currency:"INR"|"AED"|"SAR"}), hoursPerDay (number), job (one of driver, helper, cleaner, mason, electrician, plumber, cook, carpenter, welder, painter, labour, security guard, shepherd, camel herder, farm worker, domestic worker),
salaryPaid (boolean), passportHeld (boolean), huroob (boolean), distress (array of: violence, threat, help, deprivation, confinement), phones (array of strings), places (array of strings).
If the speaker corrects themselves, use the final value. Omit keys you cannot find.` },
      { role: 'user', content: transcript },
    ],
  });
  try { return JSON.parse(r.choices[0]?.message?.content ?? '{}'); } catch { return {}; }
}

/** L5: translate to English with critical terms locked as placeholders. */
export async function safeTranslate(text: string, locked: string[]): Promise<string> {
  let masked = text;
  const uniq = [...new Set(locked)].sort((a, b) => b.length - a.length);
  uniq.forEach((term, i) => { masked = masked.split(term).join(`⟦${i}⟧`); });
  const r = await ai().chat.completions.create({
    model: TEXT_MODEL(), temperature: 0,
    messages: [
      { role: 'system', content: 'Translate this Telugu-English call transcript to plain English. Keep every ⟦n⟧ placeholder exactly as is. Keep negations exact (e.g. "ivvaledu" = "did not give"). Output only the translation.' },
      { role: 'user', content: masked },
    ],
  });
  let out = r.choices[0]?.message?.content?.trim() ?? '';
  uniq.forEach((term, i) => { out = out.split(`⟦${i}⟧`).join(term); });
  return out;
}
