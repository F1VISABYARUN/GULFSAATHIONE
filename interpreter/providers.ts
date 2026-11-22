import { gateDecision } from '../server/live.ts';
import { wavFromMulaw, mulawFromPcm24k } from './media.ts';
import type { Result, Services } from './session.ts';
import type { AgentServices, AgentStep, Turn } from './agent.ts';

export interface Config {
  origin: string; backend: string; secret: string; authId: string; authToken: string;
  human: string; openai: string; target: string; mode?: 'agent' | 'keypad';
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

const AGENT_PROMPT = (lang: string) => `You are Saathi, acting ON BEHALF of a Telugu-speaking migrant worker in a conversation with another person who speaks ${lang}. The phone is on speaker: both can hear you. You receive the conversation so far as WORKER (Telugu), OTHER (${lang}) and AGENT (your earlier words). Reply with JSON {"say_to_other": string, "say_to_worker": string, "done": boolean}.
- say_to_other: in ${lang}, short, first person as the worker ("I would like..."). Empty if nothing should be said to them.
- say_to_worker: simple spoken Telugu letters only. When OTHER speaks, report faithfully what they said: every number, name, time and any "not"/"no". Then, if a decision is needed, ask the worker one short question.
- When WORKER states a goal or decision, speak for them. Do not invent facts, names, amounts, dates or documents about the worker.
- Never agree to a price, payment, contract, handing over a passport or ID, or signing: ask the worker in Telugu first and wait for a clear yes or no.
- If you did not understand, ask for repetition in the right language. done=true only when the worker's goal is finished or they say goodbye.`;

export function agentServices(config: Config, call: string, caseId?: string): AgentServices {
  const base = services(config, call, caseId);
  const headers = { 'x-saathi-secret': config.secret, 'content-type': 'application/json' };
  return {
    stt: (audio, language) => base.stt(audio, language),
    speak: (text, language) => base.speak(text, language),
    handoff: () => base.handoff(),
    alert: text => base.alert?.(text) ?? Promise.resolve(),
    async check(text) {
      if (gateDecision([{text}], {}).action === 'ESCALATE') return 'emergency';
      if (!caseId) return 'ok';
      const response = await checked(config.backend+'/api/gate', {method:'POST', headers, body:JSON.stringify({text, case_id:caseId})});
      const result = await response.json();
      return result.covert ? 'covert' : result.status === 'emergency' ? 'emergency' : 'ok';
    },
    async think(history: Turn[], target: string): Promise<AgentStep> {
      const model = process.env.INTERPRETER_AGENT_MODEL || 'gpt-4.1';
      const response = await checked('https://api.openai.com/v1/chat/completions', {method:'POST',
        headers:{authorization:'Bearer '+config.openai,'content-type':'application/json'},
        body:JSON.stringify({model, response_format:{type:'json_object'}, ...(model.startsWith('gpt-5') ? {reasoning_effort:'low'} : {temperature:0}),
          messages:[{role:'system',content:AGENT_PROMPT(target)},
            {role:'user',content:history.slice(-24).map(t=>t.who.toUpperCase()+': '+t.text).join('\n')}]})});
      const body = await response.json();
      try { return JSON.parse(body.choices[0].message.content) as AgentStep; } catch { return {}; }
    },
  };
}
