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
      // Telugu uses the same Cartesia voice as the Bolna Helpline when a key is set; everything else uses OpenAI.
      if (language === 'te' && process.env.CARTESIA_API_KEY) {
        try {
          const response = await checked('https://api.cartesia.ai/tts/bytes', {method:'POST',
            headers:{'X-API-Key':process.env.CARTESIA_API_KEY,'Cartesia-Version':process.env.CARTESIA_VERSION || '2025-04-16','content-type':'application/json'},
            body:JSON.stringify({model_id:process.env.CARTESIA_MODEL || 'sonic-3.5',transcript:text,language:'te',
              voice:{mode:'id',id:process.env.CARTESIA_VOICE_ID || '563850d9-0517-4797-ba75-b00d3934813a'},
              output_format:{container:'raw',encoding:'pcm_s16le',sample_rate:24000}})});
          return mulawFromPcm24k(Buffer.from(await response.arrayBuffer()));
        } catch (e) { if (process.env.INTERPRETER_DEBUG === '1') console.info(JSON.stringify({component:'phone-interpreter',event:'cartesia_failed_using_openai',message:String((e as Error)?.message ?? e).slice(0,120)})); }
      }
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

const AGENT_PROMPT = (lang: string) => `You are Saathi, speaking ON BEHALF of a Telugu-speaking migrant worker to another person who speaks ${lang}, on one phone call. Both hear you. You receive the conversation so far as WORKER (Telugu), OTHER (${lang}) and AGENT (your own earlier words). Reply with JSON {"say_to_other": string, "say_to_worker": string, "done": boolean}.
How to sound: natural and brief, like a person helping a friend. Never announce what you are doing ("I will translate", "I will tell them in Arabic"), never greet again, never explain who you are: the opening already did that. One short sentence at a time.
- say_to_other: in ${lang}, first person AS the worker ("I would like a ticket to Hyderabad"). Empty if nothing should be said to them now.
- say_to_worker: simple spoken Telugu letters only, and ONLY when the worker needs to know or decide something. Empty when you simply spoke for them. Do not repeat what the worker said back to them.
- When OTHER speaks: say_to_worker reports faithfully what they said (every number, name, time, and any "not"/"no") in one or two short Telugu sentences, then at most one short question if a decision is needed. say_to_other stays empty unless a harmless clarifying question is needed.
- When WORKER states a goal or decision, speak for them in ${lang}. Do not invent facts, names, amounts, dates or documents about the worker.
- Never agree to a price, payment, contract, handing over a passport or ID, or signing: ask the worker in Telugu first and wait for a clear yes or no.
- Tools: when the worker asks YOU for help (find a place, directions, visa ending or expired, check an agent or a fee, trouble), call the matching tool, then put its returned Telugu (sayTe or instruction) in say_to_worker, word for word, and say nothing to the other person. Never invent a place, fee, fine or date that a tool did not return.
- The worker may also talk to YOU (greetings, "can you hear me?", "do you speak Telugu?", questions about what you will do): answer those in Telugu only, in a few words, and say nothing to the other person. Speak to the other person only for what the worker wants told or asked.
- Do not offer help, ask "what do you need" or add pleasantries after the opening. Say nothing unless there is something to say to the other person or something the worker must know or decide.
- If the worker has not yet said what they need, say nothing to the other person and ask the worker in Telugu. Never speak to the other person first.
- If you did not understand, ask for repetition in the right language. done=true only when the worker's goal is finished or they say goodbye.
Example. WORKER: "నాకు హైదరాబాద్ టికెట్ కావాలి" -> {"say_to_other":"I would like a ticket to Hyderabad, please.","say_to_worker":"","done":false}. OTHER: "It is 200 dirhams" -> {"say_to_other":"","say_to_worker":"వాళ్ళు 200 దిర్హామ్స్ అంటున్నారు. సరేనా?","done":false}. WORKER: "వినిపిస్తుందా?" -> {"say_to_other":"","say_to_worker":"వినిపిస్తోంది.","done":false}. WORKER: "సరే" with nothing proposed yet -> {"say_to_other":"","say_to_worker":"","done":false}.`;

const TOOL_PATHS: Record<string,string> = { find_place:'/tools/find-place', directions:'/tools/directions', exit_path:'/tools/exit-path',
  check_agent:'/tools/check-agent', check_fee:'/tools/check-fee', report_problem:'/tools/report-problem' };
const tool = (name: string, description: string, props: Record<string,string>) => ({type:'function', function:{name, description,
  parameters:{type:'object', properties:Object.fromEntries(Object.entries(props).map(([k,v])=>[k,{type:'string',description:v}])), required:Object.keys(props).filter(k=>k==='caller_said')}}});
const TOOL_DEFS = [
  tool('find_place','Find a pharmacy, hospital, police, embassy, Indian restaurant, bus stop, ATM, temple or mosque near a landmark the WORKER names. Use only when the worker asks YOU for help finding a place, never when they want the other person told something. If no landmark was said, ask the worker for one first.',
    {caller_said:'The landmark words the worker said, copied exactly.', what:'pharmacy, hospital, police, embassy, Indian restaurant, bus stop, ATM, temple or mosque.', city:'City if known, else empty.'}),
  tool('directions','Walking or transit directions from a landmark the worker names to a destination.', {caller_said:'The landmark where the worker is, copied exactly.', destination:'Where they want to go.', mode:'walking or transit.', city:'City if known.'}),
  tool('exit_path','Guided steps when the worker\'s visa is ending or expired, they have no passport, or want to go home. Pass what you know and an empty string for the rest; it returns the next question or the plan.',
    {caller_said:'The worker\'s exact words.', country:'Country as said, else empty.', visa_type:'visit/tourist, work or residence, else empty.', expiry:'Visa end date exactly as said (or "5 days"), else empty.', passport_with_worker:'yes or no, else empty.', problem:'Problem in a few words, else empty.', intent:'go home or stay, else empty.'}),
  tool('check_agent','Check a recruiting agent against the government registered list.', {caller_said:'The worker\'s exact words.', agency:'Agency name, else empty.', owner:'Agent name, else empty.', district:'District, else empty.', licence_no:'RC or RA number, else empty.'}),
  tool('check_fee','Check money paid or asked by an agent against the legal limit. Never add numbers yourself.', {caller_said:'The worker\'s exact words.', payments:'Each payment in rupees as digits, separated by semicolons.'}),
  tool('report_problem','Record that the worker is in trouble (passport taken, not paid, locked in, stranger took them, no food). Call at once, then say its instruction.', {caller_said:'The worker\'s exact words.', threatened:'yes if beaten or threatened, else empty.', taken_by_stranger:'yes if someone other than the employer took them, else empty.', passport_with_worker:'no if the passport was taken, else empty.'}),
];

export function agentServices(config: Config, call: string, caseId?: string, from?: string): AgentServices {
  const base = services(config, call, caseId);
  const headers = { 'x-saathi-secret': config.secret, 'content-type': 'application/json' };
  const phone = from && /^\+?\d{6,15}$/.test(from) ? from : '';
  async function runTool(name: string, args: Record<string,unknown>) {
    const path = TOOL_PATHS[name];
    if (!path) return {error: 'unknown tool'};
    const clean = Object.fromEntries(Object.entries(args).map(([k,v])=>[k, typeof v === 'string' ? v.slice(0, 1000) : '']));
    const response = await checked(config.backend+path, {method:'POST', headers, body:JSON.stringify({...clean, caller_phone: phone, ...(caseId ? {case_id: caseId} : {})})});
    return response.json();
  }
  return {
    // Hear with OpenAI (auto language) and Sarvam at the same time. Sarvam's text is used only when OpenAI also heard Telugu
    // (Sarvam is forced to Telugu and would turn other languages into Telugu-looking nonsense).
    async stt(audio, language) {
      const sarvam = async () => {
        if (process.env.INTERPRETER_SARVAM === 'off') return '';
        try {
          const form = new FormData();
          form.append('audio', new Blob([new Uint8Array(wavFromMulaw(audio))], {type:'audio/wav'}), 'turn.wav');
          form.append('language', 'te'); form.append('model', 'saaras:v3');
          const response = await checked(config.backend+'/api/saathi/stt', {method:'POST', headers:{'x-saathi-secret':config.secret}, body:form});
          const result = await response.json();
          return result.status === 'transcribed' && typeof result.text === 'string' ? result.text.trim() : '';
        } catch { return ''; }
      };
      const [heard, fromSarvam] = await Promise.all([base.stt(audio, language), sarvam()]);
      const telugu = /[\u0C00-\u0C7F]/;
      const arabicScript = /[\u0600-\u06FF\u0750-\u077F]/;
      const sarvamTelugu = telugu.test(fromSarvam) ? fromSarvam : '';
      // For an Arabic- or Urdu-speaking other person the script decides who spoke: OpenAI's own language guess on phone-quality
      // Telugu is unreliable (it returned Turkish, Tamil and "Hello"), so anything that is not Arabic script is the Telugu speaker.
      if (config.target === 'ar' || config.target === 'ur') {
        if (arabicScript.test(heard)) {
          try { const hinted = (await base.stt(audio, config.target)).trim(); if (arabicScript.test(hinted)) return hinted; } catch { /* keep the first result */ }
          return heard;
        }
        return sarvamTelugu || (telugu.test(heard) ? heard : '');
      }
      if (telugu.test(heard)) return sarvamTelugu || heard;
      if (heard.trim() && config.target) {
        try { const hinted = (await base.stt(audio, config.target)).trim(); if (hinted) return hinted; } catch { /* keep the first result */ }
      }
      return heard;
    },
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
    // The model may call the same tools as the Bolna Helpline (places, directions, Exit Path, agent and fee checks, problem report).
    // Each tool is one of our own backend endpoints; its answer comes back to the model, which puts the returned Telugu in say_to_worker.
    async think(history: Turn[], target: string): Promise<AgentStep> {
      const model = process.env.INTERPRETER_AGENT_MODEL || 'gpt-4.1';
      const messages: object[] = [{role:'system',content:AGENT_PROMPT(target)},
        {role:'user',content:history.slice(-24).map(t=>t.who.toUpperCase()+': '+t.text).join('\n')}];
      for (let round = 0; round < 3; round++) {
        const response = await checked('https://api.openai.com/v1/chat/completions', {method:'POST',
          headers:{authorization:'Bearer '+config.openai,'content-type':'application/json'},
          body:JSON.stringify({model, response_format:{type:'json_object'}, ...(model.startsWith('gpt-5') ? {reasoning_effort:'low'} : {temperature:0}),
            messages, ...(round < 2 ? {tools: TOOL_DEFS} : {})})});
        const body = await response.json();
        const message = body.choices?.[0]?.message;
        if (message?.tool_calls?.length) {
          messages.push(message);
          for (const callInfo of message.tool_calls) {
            let result: unknown;
            try { result = await runTool(callInfo.function?.name, JSON.parse(callInfo.function?.arguments || '{}')); }
            catch { result = {error: 'tool unavailable'}; }
            messages.push({role:'tool', tool_call_id: callInfo.id, content: JSON.stringify(result).slice(0, 3000)});
          }
          continue;
        }
        try { return JSON.parse(message?.content) as AgentStep; } catch { return {}; }
      }
      return {};
    },
  };
}
