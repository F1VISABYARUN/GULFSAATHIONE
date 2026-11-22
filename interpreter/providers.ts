import { gateDecision } from '../server/live.ts';
import { wavFromMulaw, mulawFromPcm24k } from './media.ts';
import type { Result, Services } from './session.ts';

export interface Config {
  origin: string; backend: string; secret: string; authId: string; authToken: string;
  human: string; openai: string; target: string;
}

async function checked(url: string, init: RequestInit) {
  const response = await fetch(url, { ...init, redirect:'error', signal: AbortSignal.timeout(55000) });
  if (!response.ok) throw Error('Provider unavailable');
  return response;
}

export function services(config: Config, call: string, caseId?: string): Services {
  const headers = { 'x-saathi-secret': config.secret };
  return {
    async stt(audio, language) {
      const form = new FormData();
      form.append('audio', new Blob([new Uint8Array(wavFromMulaw(audio))], {type:'audio/wav'}), 'turn.wav');
      form.append('language', language);
      form.append('model', process.env.INTERPRETER_STT_MODEL || 'gpt-4o-transcribe');
      const response = await checked(config.backend+'/api/saathi/stt', {method:'POST', headers, body:form});
      const result = await response.json();
      return result.status === 'transcribed' && typeof result.text === 'string' ? result.text : '';
    },
    async translate(text, from, to, confirmed = false) {
      const gate = gateDecision([{text}], {});
      if (gate.action === 'ESCALATE') return {status:'emergency'};
      if (!confirmed && !caseId && gate.action === 'CONFIRM') return {status:'needs_confirm'};
      // The backend also gates non-Telugu emergency phrases and withholds legal statements.
      const response = await checked(config.backend+'/api/translate', { method:'POST',
        headers:{...headers,'content-type':'application/json'}, body:JSON.stringify({text,from,to,mode:'relay',case_id:caseId,...(confirmed?{confirmed:true}:{})}) });
      const result: Result = await response.json();
      if (!confirmed && gate.action === 'CONFIRM' && result.status === 'translated') return {status:'needs_confirm'};
      if (to === 'te' && result.status === 'translated' && result.say_to_worker) {
        const targetGate = gateDecision([{text:result.say_to_worker}], {});
        if (targetGate.action === 'ESCALATE') return {status:'emergency'};
        if (!confirmed && targetGate.action === 'CONFIRM') return {status:'needs_confirm'};
      }
      return result;
    },
    async speak(text, language) {
      const response = await checked('https://api.openai.com/v1/audio/speech', {method:'POST',
        headers:{authorization:'Bearer '+config.openai,'content-type':'application/json'},
        body:JSON.stringify({model:'gpt-4o-mini-tts',input:text,voice:'alloy',response_format:'pcm',
          instructions:'Read exactly the supplied words in '+language+'. Do not expand or add words.'})});
      return mulawFromPcm24k(Buffer.from(await response.arrayBuffer()));
    },
    // Silent desk alert for a private phrase: never transfers or announces anything on the shared line.
    async alert(text) {
      if (!caseId) return;
      await checked(config.backend+'/tools/record-checkin', {method:'POST', headers:{...headers,'content-type':'application/json'},
        body:JSON.stringify({case_id:caseId, caller_said:text, call_kind:'interpreter'})});
    },
    async handoff() {
      const url = 'https://api.plivo.com/v1/Account/'+encodeURIComponent(config.authId)+'/Call/'+encodeURIComponent(call)+'/';
      await checked(url, {method:'POST',headers:{authorization:'Basic '+Buffer.from(config.authId+':'+config.authToken).toString('base64'),
        'content-type':'application/json'},body:JSON.stringify({legs:'aleg',aleg_url:config.origin+'/human',aleg_method:'GET'})});
    },
  };
}
