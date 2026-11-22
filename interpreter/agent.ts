import { hasVoice } from './media.ts';
import { disclosure } from './session.ts';
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
// Said to the OTHER person once, in front of the first thing we say to them (never as a phone menu at the start of the call).
// First-pass wording by the author, not reviewed by native speakers.
export const agentDisclosure: Record<string, string> = {
  te: 'నేను సాథి ఏఐని, తెలుగు మాట్లాడే వారి తరపున మాట్లాడుతున్నాను.',
  ar: 'أنا مساعد ذكاء اصطناعي، أتحدث نيابة عن المتحدث بالتيلوغو، والصوت يُعالج بخدمات الترجمة.',
  en: 'I am an AI assistant speaking on behalf of the Telugu speaker; the audio is processed by translation services.',
  hi: 'मैं एआई सहायक हूँ और तेलुगु बोलने वाले की ओर से बोल रहा हूँ; आवाज़ अनुवाद सेवाओं से प्रोसेस होती है।',
  ur: 'میں مصنوعی ذہانت کا معاون ہوں اور تیلگو بولنے والے کی طرف سے بات کر رہا ہوں؛ آواز ترجمے کی خدمات سے پروسیس ہوتی ہے۔',
  ml: 'ഞാൻ ഒരു എ ഐ സഹായിയാണ്, തെലുങ്ക് സംസാരിക്കുന്നയാളുടെ പേരിൽ സംസാരിക്കുന്നു; ശബ്ദം പരിഭാഷാ സേവനങ്ങൾ പ്രോസസ് ചെയ്യും.',
};
const greeting = 'నమస్కారం, నేను సాథి. చెప్పండి, ఏం కావాలి?';
const askAgain: Record<string, string> = { ar: 'من فضلك أعد الكلام.', en: 'Please say that again.', hi: 'कृपया फिर से कहिए।', ur: 'براہ کرم دوبارہ کہیں۔', ml: 'ദയവായി ഒന്നുകൂടി പറയൂ.' };
const cannotTranslate = 'వాళ్ళు చెప్పింది సరిగా చెప్పలేకపోయాను. మళ్ళీ చెప్పమని అడుగుతున్నాను.';
const needNumber = 'ఈ సంఖ్య మీరు చెప్పలేదు. మీరే చెప్పండి.';
const transferFailed = 'మనిషికి కలపలేకపోయాను. మన టీమ్‌కు తెలియజేశాను. మీరు చెప్పండి.';

const digits = (t: string) => (t.replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x660)).replace(/[౦-౯]/g, d => String(d.charCodeAt(0) - 0xc66))
  .match(/\d+(?:[.,]\d+)*/g) ?? []).map(v => Number(v.replace(/,/g, ''))).filter(n => n >= 10);
export const numbersIn = (t: string) => [...new Set([...numberValues(tokenize(t)), ...digits(t)])];
const BARGE_BYTES = 2400;   // 0.3 s of voice interrupts our speech
const MIN_VOICED = 2400;   // 0.3 s of speech at 8 kHz (same as the interruption threshold); shorter sounds are line noise
const JUNK = /^[\s.,!?'"-]*(thank you|thanks|thank you for watching|you|bye|okay|ok|hello|hi|yeah|uh|um|hmm)?[\s.,!?'"-]*$/i;
// Telugu acknowledgements and greetings are talk to the agent, never something to say to the other person.
const FILLER = /^[\s.,!?'"-]*((సరే|సరేనండి|అలాగే|ఓకే|అవును|హా|ఆ|హలో|నమస్తే|నమస్కారం|థాంక్యూ|థాంక్స్|ధన్యవాదాలు|ఊ|ఊఁ|హమ్|ఎస్)[\s.,!?'"-]*)+$/u;
// An agreement in Arabic/English before the other person has proposed anything is an invention.
const AGREEMENT = /موافق|أوافق|اتفقنا|\b(agree|agreed|deal|accept)\b/i;
const junk = (t: string) => FILLER.test(t) || JUNK.test(t) || t.replace(/[^\p{L}\p{N}]/gu, '').length < 2;
const flat = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const sameAs = (a: string, b: string) => { const x = flat(a), y = flat(b); return x.length > 8 && y.length > 8 && (y.includes(x) || x.includes(y)); };
const telugu = (t: string) => /[ఀ-౿]/.test(t);

// The agent speaks for the worker on a shared (speaker) phone. Code, not the model, enforces: no number the
// people did not say, no number dropped in the Telugu relay, and no reply to an amount before the worker decides.
export class AgentSession {
  private generation = 0;
  private checkpoint = '';
  private afterPlay = () => {};
  private marker = 0;
  private phase: 'opening' | 'speaking' | 'listen' | 'busy' | 'handoff' | 'closed' = 'opening';
  private frames: Buffer[] = [];
  private length = 0; private voiced = false; private silence = 0;
  private history: Turn[] = [];
  private disclosed = false;       // the other person has been told once that we are an AI speaking for the worker
  private goalSet = false;            // the worker has said what they need; before that nothing is said to the other person
  private lastSpoken = '';
  private deafUntil = 0;              // ignore the line briefly after our own speech so we do not hear ourselves
  private voicedBytes = 0;
  private pre: Buffer[] = [];          // recent audio while we speak, kept so an interruption is not cut off at the start
  private bargeBytes = 0;
  private debug = process.env.INTERPRETER_DEBUG === '1';

  constructor(private target: string, private service: AgentServices, private out: AgentOutput, private graceMs = 700) {
    if (!Object.hasOwn(disclosure, target)) throw Error('Unsupported language');
  }
  private clearAudio() { this.frames = []; this.length = 0; this.silence = 0; this.voiced = false; this.voicedBytes = 0; }
  private log(event: string, data: object = {}) { if (this.debug) console.info(JSON.stringify({ component: 'phone-interpreter', event, ...data })); }
  close() { this.generation++; this.clearAudio(); this.phase = 'closed'; }
  private async say(lines: [string, string][], next: () => void) {
    const id = this.generation;
    try {
      const audio = await Promise.all(lines.filter(([t]) => t).map(([t, l]) => this.service.speak(t, l)));
      if (id !== this.generation) return;
      const bytes = Buffer.concat(audio);
      const mark = this.checkpoint = id + '-' + (++this.marker);
      this.afterPlay = next;
      this.phase = 'speaking'; this.pre = []; this.bargeBytes = 0;
      this.out.play(bytes, mark);
      // If Plivo never confirms playback (its event contract is unverified), do not stay deaf: carry on after the audio length plus 3 s.
      setTimeout(() => {
        if (this.checkpoint === mark && id === this.generation) { this.checkpoint = ''; this.out.metric?.('played_timeout', 0); this.deafUntil = Date.now() + this.graceMs; this.afterPlay(); }
      }, bytes.length / 8 + 3000).unref();
    } catch { if (id === this.generation) { this.close(); this.out.close(); } }
  }
  private listen() { this.clearAudio(); this.phase = 'listen'; this.out.metric?.('listening', 0); }
  async start() { await this.say([[greeting, 'te']], () => this.listen()); }
  played(mark: string) { if (mark && this.checkpoint === mark) { this.checkpoint = ''; this.deafUntil = Date.now() + this.graceMs; this.afterPlay(); } }
  async digit(key: string) { if (key === '0' && this.phase !== 'closed') { this.close(); this.out.close(); } }
  // The caller can interrupt us: sustained voice while we speak stops our audio and starts listening, like Bolna.
  private bargeIn(frame: Buffer) {
    if (!frame.length || process.env.INTERPRETER_BARGE_IN === 'off') return;
    this.pre.push(frame);
    while (this.pre.reduce((n, f) => n + f.length, 0) > 8000) this.pre.shift();
    if (hasVoice(frame)) this.bargeBytes += frame.length; else this.bargeBytes = Math.max(0, this.bargeBytes - frame.length);
    if (this.bargeBytes < BARGE_BYTES) return;
    this.out.clear(); this.checkpoint = ''; this.afterPlay = () => {};
    this.clearAudio();
    this.frames = [...this.pre]; this.length = this.frames.reduce((n, f) => n + f.length, 0);
    this.voiced = true; this.voicedBytes = this.bargeBytes; this.phase = 'listen';
    this.out.metric?.('barge_in', 0);
  }
  async media(frame: Buffer) {
    if (this.phase === 'speaking') { this.bargeIn(frame); return; }
    if (this.phase !== 'listen' || !frame.length || Date.now() < this.deafUntil) return;
    this.length += frame.length;
    if (this.length > 30 * 8000) { this.clearAudio(); return; }
    this.frames.push(frame);
    if (hasVoice(frame)) { this.voiced = true; this.voicedBytes += frame.length; this.silence = 0; } else this.silence += frame.length;
    if (this.voiced && this.silence >= 5000) await this.finish();
  }
  private async finish() {
    const id = this.generation;
    this.phase = 'busy';
    const audio = Buffer.concat(this.frames); const voicedBytes = this.voicedBytes; this.clearAudio();
    try {
      if (voicedBytes < MIN_VOICED) { this.out.metric?.('ignored_short_bytes', voicedBytes); this.log('ignored', { why: 'too short', voicedBytes }); this.listen(); return; }
      const began = Date.now();
      const text = (await this.service.stt(audio, '')).trim();
      this.out.metric?.('asr', Date.now() - began);
      if (id !== this.generation) return;
      if (!text || text.length > 2000) { this.listen(); return; }
      const who = telugu(text) ? 'worker' : 'other';
      const why = junk(text) ? (FILLER.test(text) ? 'filler' : 'noise') : sameAs(text, this.lastSpoken) ? 'echo' : who === 'other' && !this.goalSet ? 'no goal yet' : '';
      this.log('heard', { who, text, ignored: why || undefined });
      if (why) { this.listen(); return; }
      if (who === 'worker') this.goalSet = true;
      const verdict = await this.service.check(text);
      if (id !== this.generation) return;
      if (verdict === 'covert') { this.service.alert?.(text).catch(() => {}); this.listen(); return; }
      if (verdict === 'emergency') { await this.transfer(id, text); return; }
      this.history.push({ who, text });
      const step = await this.service.think(this.history, this.target);
      if (id !== this.generation) return;
      this.out.metric?.('think', Date.now() - began);
      await this.speakStep(id, who, text, step);
    } catch (e) { this.log('error', { message: String((e as Error)?.message ?? e).slice(0, 200) }); if (id === this.generation) this.listen(); }
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
    let markDisclosed = false;
    let toOther = (step.say_to_other ?? '').trim(), toWorker = (step.say_to_worker ?? '').trim();
    if (toWorker && !telugu(toWorker)) toWorker = '';                  // the report to the worker must be in Telugu letters
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
    if (toOther && AGREEMENT.test(toOther) && !this.history.some(t => t.who === 'other')) { toOther = ''; toWorker = ''; this.log('blocked', { why: 'agreement before any proposal' }); }
    if (toOther && !this.disclosed) { toOther = (agentDisclosure[this.target] ?? agentDisclosure.en) + ' ' + toOther; markDisclosed = true; }
    this.lastSpoken = [toOther, toWorker].filter(Boolean).join(' ');
    this.log('say', { to_other: toOther, to_worker: toWorker });
    await this.say([[toOther, this.target], [toWorker, 'te']], () => { if (markDisclosed) this.disclosed = true; if (step.done) { this.close(); this.out.close(); } else this.listen(); });
  }
}
