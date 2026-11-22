import { hasVoice } from './media.ts';
import { disclosure, teDisclosure } from './session.ts';
import { numberValues } from '../server/harness/numbers.ts';
import { tokenize } from '../server/harness/tokens.ts';

export interface Turn { who: 'worker' | 'other' | 'agent'; text: string }
export interface AgentStep { say_to_other?: string; say_to_worker?: string; done?: boolean }
export interface AgentServices {
  stt(audio: Buffer, language: string): Promise<string>;
  think(history: Turn[], target: string): Promise<AgentStep>;
  check(text: string): Promise<'ok' | 'emergency' | 'covert'>;
  speak(text: string, language: string): Promise<Buffer>;
  handoff(): Promise<void>;
  alert?(text: string): Promise<void>;
}
export interface AgentOutput {
  metric?(event: string, ms: number): void;
  play(bytes: Buffer, mark: string): void;
  clear(): void;
  close(): void;
}

// First-pass wording by the author, not reviewed by native speakers.
const intro = 'చెప్పండి, నేను మీ తరఫున మాట్లాడతాను. మీకు ఏం కావాలి?';
const askAgain: Record<string, string> = { ar: 'من فضلك أعد الكلام.', en: 'Please say that again.', hi: 'कृपया फिर से कहिए।', ur: 'براہ کرم دوبارہ کہیں۔', ml: 'ദയവായി ഒന്നുകൂടി പറയൂ.' };
const cannotTranslate = 'వాళ్ళు చెప్పింది సరిగా చెప్పలేకపోయాను. మళ్ళీ చెప్పమని అడుగుతున్నాను.';
const needNumber = 'ఈ సంఖ్య మీరు చెప్పలేదు. మీరే చెప్పండి.';
const transferFailed = 'మనిషికి కలపలేకపోయాను. మన టీమ్‌కు తెలియజేశాను. మీరు చెప్పండి.';

const digits = (t: string) => (t.replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x660)).replace(/[౦-౯]/g, d => String(d.charCodeAt(0) - 0xc66))
  .match(/\d+(?:[.,]\d+)*/g) ?? []).map(v => Number(v.replace(/,/g, ''))).filter(n => n >= 10);
export const numbersIn = (t: string) => [...new Set([...numberValues(tokenize(t)), ...digits(t)])];
const telugu = (t: string) => /[ఀ-౿]/.test(t);

// The agent speaks for the worker on a shared (speaker) phone. Code, not the model, enforces: no number the
// people did not say, no number dropped in the Telugu relay, and no reply to an amount before the worker decides.
export class AgentSession {
  private generation = 0;
  private checkpoint = '';
  private afterPlay = () => {};
  private marker = 0;
  private phase: 'opening' | 'listen' | 'busy' | 'handoff' | 'closed' = 'opening';
  private frames: Buffer[] = [];
  private length = 0; private voiced = false; private silence = 0;
  private history: Turn[] = [];

  constructor(private target: string, private service: AgentServices, private out: AgentOutput) {
    if (!Object.hasOwn(disclosure, target)) throw Error('Unsupported language');
  }
  private clearAudio() { this.frames = []; this.length = 0; this.silence = 0; this.voiced = false; }
  close() { this.generation++; this.clearAudio(); this.phase = 'closed'; }
  private async say(lines: [string, string][], next: () => void) {
    const id = this.generation;
    try {
      const audio = await Promise.all(lines.filter(([t]) => t).map(([t, l]) => this.service.speak(t, l)));
      if (id !== this.generation) return;
      this.checkpoint = id + '-' + (++this.marker);
      this.afterPlay = next;
      this.out.play(Buffer.concat(audio), this.checkpoint);
    } catch { if (id === this.generation) { this.close(); this.out.close(); } }
  }
  private listen() { this.clearAudio(); this.phase = 'listen'; }
  async start() { await this.say([[teDisclosure, 'te'], [disclosure[this.target], this.target], [intro, 'te']], () => this.listen()); }
  played(mark: string) { if (mark && this.checkpoint === mark) { this.checkpoint = ''; this.afterPlay(); } }
  async digit(key: string) { if (key === '0' && this.phase !== 'closed') { this.close(); this.out.close(); } }
  async media(frame: Buffer) {
    if (this.phase !== 'listen' || !frame.length) return;
    this.length += frame.length;
    if (this.length > 30 * 8000) { this.clearAudio(); return; }
    this.frames.push(frame);
    if (hasVoice(frame)) { this.voiced = true; this.silence = 0; } else this.silence += frame.length;
    if (this.voiced && this.silence >= 6000) await this.finish();
  }
  private async finish() {
    const id = this.generation;
    this.phase = 'busy';
    const audio = Buffer.concat(this.frames); this.clearAudio();
    try {
      const began = Date.now();
      const text = (await this.service.stt(audio, '')).trim();
      this.out.metric?.('asr', Date.now() - began);
      if (id !== this.generation) return;
      if (!text || text.length > 2000) { this.listen(); return; }
      const who = telugu(text) ? 'worker' : 'other';
      const verdict = await this.service.check(text);
      if (id !== this.generation) return;
      if (verdict === 'covert') { this.service.alert?.(text).catch(() => {}); this.listen(); return; }
      if (verdict === 'emergency') { await this.transfer(id, text); return; }
      this.history.push({ who, text });
      const step = await this.service.think(this.history, this.target);
      if (id !== this.generation) return;
      this.out.metric?.('think', Date.now() - began);
      await this.speakStep(id, who, text, step);
    } catch { if (id === this.generation) this.listen(); }
  }
  private async transfer(id: number, text: string) {
    this.phase = 'handoff';
    try { await this.service.handoff(); }
    catch {
      if (id !== this.generation) return;
      this.service.alert?.(text).catch(() => {});
      this.phase = 'busy';
      await this.say([[transferFailed, 'te']], () => this.listen());
    }
  }
  private async speakStep(id: number, who: 'worker' | 'other', text: string, step: AgentStep) {
    let toOther = (step.say_to_other ?? '').trim(), toWorker = (step.say_to_worker ?? '').trim();
    const heard = new Set(this.history.filter(t => t.who !== 'agent').flatMap(t => numbersIn(t.text)));
    if (who === 'other') {
      const said = numbersIn(text);
      if (said.length) toOther = '';                                   // the worker decides before anything is answered
      if (said.some(n => !numbersIn(toWorker).includes(n)) || !toWorker) {
        toOther = askAgain[this.target] ?? askAgain.en; toWorker = cannotTranslate;
      }
    } else if (numbersIn(toOther).some(n => !heard.has(n))) {
      toOther = ''; toWorker = needNumber;                             // never invent an amount, date or number
    }
    if (!toOther && !toWorker) { this.listen(); return; }
    if (toOther) this.history.push({ who: 'agent', text: toOther });
    if (toWorker) this.history.push({ who: 'agent', text: toWorker });
    await this.say([[toOther, this.target], [toWorker, 'te']], () => { if (step.done) { this.close(); this.out.close(); } else this.listen(); });
  }
}
