import { hasVoice } from './media.ts';

const te = 'నేను సాథి ఏఐ అనువాదకుడిని. మీ మాటలను కంప్యూటర్ సేవలతో అనువదిస్తాను. ఇద్దరూ అంగీకరిస్తే తెలుగు మాట్లాడే వారు ఒకటి, తరువాత రెండో వ్యక్తి రెండు నొక్కండి. తరువాత ప్రతి సారి తెలుగుకు ఒకటి లేదా రెండో భాషకు రెండు నొక్కి మాట్లాడి హాష్ నొక్కండి. సరిగ్గా విన్నట్లయితే మూడు నొక్కండి. ఆపడానికి సున్నా నొక్కండి.';
export const disclosure: Record<string, string> = {
  ar:'أنا مترجم آلي وأرسل الكلام إلى خدمات الترجمة. إذا وافق كلاكما، يضغط المتحدث بالتيلوغو واحداً ثم تضغط أنت اثنين. بعد ذلك اضغط اثنين قبل الكلام ثم مربع عند الانتهاء. اضغط ثلاثة لتأكيد ما سمعت أو صفراً للإيقاف.',
  en:'I am an AI interpreter. Speech is sent to speech and translation providers. If both agree, the Telugu speaker presses one and then the other speaker presses two. After consent press one for Telugu or two for the other language before each turn, then hash to finish. Press three to confirm the read-back or zero to stop.',
  hi:'मैं एआई अनुवादक हूँ। आपकी आवाज़ अनुवाद सेवाओं को भेजी जाती है। दोनों सहमत हों तो तेलुगु वक्ता एक और फिर दूसरा वक्ता दो दबाए। उसके बाद अपनी बारी पर एक या दो दबाकर बोलें और अंत में हैश दबाएँ। पुष्टि के लिए तीन, रोकने के लिए शून्य दबाएँ।',
  ur:'میں مصنوعی ذہانت کا ترجمان ہوں۔ آواز ترجمے کی خدمات کو بھیجی جاتی ہے۔ دونوں راضی ہوں تو تیلگو بولنے والا ایک اور پھر دوسرا شخص دو دبائے۔ پھر اپنی باری پر ایک یا دو دبا کر بولیں اور آخر میں ہیش دبائیں۔ تصدیق کے لیے تین اور روکنے کے لیے صفر دبائیں۔',
  ml:'ഞാൻ ഒരു എ ഐ പരിഭാഷകനാണ്. സംസാരം പരിഭാഷാ സേവനങ്ങളിലേക്ക് അയയ്ക്കും. ഇരുവർക്കും സമ്മതമെങ്കിൽ തെലുങ്ക് സംസാരിക്കുന്നയാൾ ഒന്നും തുടർന്ന് മറ്റേയാൾ രണ്ടും അമർത്തുക. ഓരോ തവണയും ഒന്നോ രണ്ടോ അമർത്തി സംസാരിച്ച ശേഷം ഹാഷ് അമർത്തുക. ശരിയെങ്കിൽ മൂന്ന്, നിർത്താൻ പൂജ്യം അമർത്തുക.',
};
const repeat: Record<string,string> = { te:'దయచేసి ఒకటి నొక్కి మళ్ళీ చెప్పండి.', ar:'اضغط اثنين وكرر من فضلك.', en:'Press two and please repeat.', hi:'दो दबाकर फिर बोलें।', ur:'دو دبا کر پھر بولیں۔', ml:'രണ്ട് അമർത്തി വീണ്ടും പറയുക.' };

export interface Result {
  status: string; say_to_worker?: string; say_to_other?: string; back_translation?: string; locked_ok?: boolean;
}
export interface Services {
  stt(audio: Buffer, language: string): Promise<string>;
  translate(text: string, from: string, to: string): Promise<Result>;
  speak(text: string, language: string): Promise<Buffer>;
  handoff(): Promise<void>;
}
export interface Output {
  metric?(event: 'asr'|'relay'|'readback_queued'|'handoff_accepted', ms:number): void;
  play(bytes: Buffer, mark: string): void;
  clear(): void;
  close(): void;
}

// A keypad selects the shared microphone's speaker. It also cancels buffered TTS without
// re-transcribing speakerphone echo. Only completed, explicitly confirmed turns are relayed.
export class PhoneSession {
  private generation = 0;
  private checkpoint = '';
  private afterPlay = () => {};
  private phase: 'opening'|'consent1'|'consent2'|'ready'|'capture'|'busy'|'confirm'|'handoff'|'closed' = 'opening';
  private from = 'te';
  private frames: Buffer[] = [];
  private length = 0;
  private voiced = false;
  private silence = 0;
  private pending?: {text: string; lang: string};

  constructor(private target: string, private service: Services, private out: Output) {
    if (!Object.hasOwn(disclosure, target)) throw Error('Unsupported language');
  }
  private reset() {
    this.generation++;
    this.checkpoint = '';
    this.frames = []; this.length = 0; this.silence = 0; this.voiced = false;
    this.pending = undefined;
  }
  close() { this.reset(); this.phase = 'closed'; }
  private async say(lines: [string,string][], next: () => void) {
    const id = this.generation;
    try {
      const audio = await Promise.all(lines.map(([text, lang]) => this.service.speak(text, lang)));
      if (id !== this.generation) return;
      this.checkpoint = String(id) + '-' + (++this.marker);
      this.afterPlay = next;
      this.out.play(Buffer.concat(audio), this.checkpoint);
    } catch {
      if (id === this.generation) { this.close(); this.out.close(); }
    }
  }
  private marker = 0;
  async start() {
    await this.say([[te,'te'],[disclosure[this.target],this.target]], () => { this.phase = 'consent1'; });
  }
  played(mark: string) {
    if (mark && this.checkpoint === mark) { this.checkpoint = ''; this.afterPlay(); }
  }
  async digit(key: string) {
    if (this.phase === 'closed' || this.phase === 'handoff') return;
    if (this.phase === 'opening' || this.phase === 'consent1' || this.phase === 'consent2') {
      if (key === '0') { this.close(); this.out.close(); return; }
      if (key === '1' && this.phase === 'consent1') this.phase = 'consent2';
      else if (key === '2' && this.phase === 'consent2') this.phase = 'ready';
      return;
    }
    if (key === '3' && this.phase === 'confirm' && this.pending) {
      const pending = this.pending;
      this.pending = undefined; this.phase = 'busy';
      await this.say([[pending.text,pending.lang]], () => { this.phase = 'ready'; });
    } else if (key === '#' && this.phase === 'capture') {
      await this.finish();
    } else if (key === '0' || key === '1' || key === '2') {
      this.reset(); this.out.clear();
      this.from = key === '2' ? this.target : 'te';
      this.phase = key === '0' ? 'ready' : 'capture';
    }
  }
  async media(frame: Buffer) {
    if (this.phase !== 'capture' || frame.length === 0) return;
    this.length += frame.length;
    if (this.length > 24 * 8000) {
      this.reset(); await this.retry(); return;
    }
    this.frames.push(frame);
    if (hasVoice(frame)) { this.voiced = true; this.silence = 0; }
    else this.silence += frame.length;
    if (this.voiced && this.silence >= 8000) await this.finish();
  }
  private async retry() {
    this.phase = 'busy';
    await this.say([[repeat[this.from],this.from]], () => { this.phase = 'ready'; });
  }
  private async finish() {
    const id = this.generation;
    const from = this.from, to = from === 'te' ? this.target : 'te';
    this.phase = 'busy';
    const audio = Buffer.concat(this.frames);
    this.frames = [];
    try {
      if (!this.voiced) { await this.retry(); return; }
      const start = Date.now();
      const text = (await this.service.stt(audio, from)).trim();
      const heard = Date.now();
      this.out.metric?.('asr', heard - start);
      if (id !== this.generation) return;
      if (!text || text.length > 4000) { await this.retry(); return; }
      const result = await this.service.translate(text, from, to);
      if (id !== this.generation) return;
      this.out.metric?.('relay',Date.now() - heard);
      if (['emergency','escalate_human'].includes(result.status)) {
        this.phase = 'handoff';
        await this.service.handoff();
        this.out.metric?.('handoff_accepted',Date.now()-heard);
        return;
      }
      const targetText = to === 'te' ? result.say_to_worker : result.say_to_other;
      if (result.status !== 'translated' || !result.locked_ok || !targetText || !result.back_translation) {
        await this.retry(); return;
      }
      this.pending = { text: targetText, lang: to };
      const preview: [string,string][] = [[text,from]];
      if (from === 'te') preview.push([result.back_translation, 'te']);
      await this.say(preview, () => { this.phase = 'confirm'; });
      if (id === this.generation) this.out.metric?.('readback_queued',Date.now()-start);
    } catch {
      if (id !== this.generation) return;
      if (this.phase === 'handoff') {
        await this.say([['ఇప్పుడు కొనసాగించలేకపోతున్నాను.','te']], () => { this.close(); this.out.close(); });
      } else await this.retry();
    }
  }
}
