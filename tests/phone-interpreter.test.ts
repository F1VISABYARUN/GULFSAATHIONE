import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createHmac } from 'node:crypto';
import { WebSocket } from 'ws';
import { createInterpreter } from '../interpreter/server.ts';
import { PhoneSession, type Services, type Result } from '../interpreter/session.ts';
import { hasVoice, wavFromMulaw, mulawFromPcm24k } from '../interpreter/media.ts';
import { services } from '../interpreter/providers.ts';
import { AgentSession, type AgentServices, type AgentStep } from '../interpreter/agent.ts';

const cfg = {origin:'https://phone.example',backend:'https://api.example',secret:'fixture',authId:'fixture',
  authToken:'fixture',human:'+19999999999',openai:'fixture',target:'ar',mode:'keypad' as const};
const ok:Result = { status:'translated',say_to_other:'AR translation',say_to_worker:'TE translation',back_translation:'TE check',locked_ok:true };
function fixture(overrides:Partial<Services>={}) {
  const spoken:string[] = [], stt:string[] = [], marks:string[] = [], cleared:string[] = [], stops:string[] = [];
  const service:Services = { stt: async (_audio,lang) => {stt.push(lang);return 'original';},
    translate: async () => ok, speak:async (text,lang)=>{spoken.push(lang+' '+text);return Buffer.from([255]);},
    handoff: async()=>{stops.push('handoff');}, ...overrides };
  const session = new PhoneSession('ar',service,{play:(_bytes,mark)=>marks.push(mark),
    clear:()=>cleared.push('clear'),close:()=>stops.push('close')});
  const consent = async () => {
    await session.start(); session.played(marks.at(-1)!);
    await session.digit('1'); await session.digit('2');
  };
  const turn = async (key:string) => {
    await session.digit(key); await session.media(Buffer.alloc(80,0)); await session.digit('#');
  };
  return {session, service, spoken, stt, marks, stops, cleared, consent, turn};
}

test('bilingual disclosure and both consents before capture; each speaker approves the readback',async()=>{
  const f=fixture(); await f.session.start();
  await f.turn('1'); assert.deepEqual(f.stt,[]);
  f.session.played(f.marks.at(-1)!); await f.session.digit('1'); await f.turn('1'); assert.deepEqual(f.stt,[]);
  await f.session.digit('2'); await f.turn('1');
  assert.deepEqual(f.stt,['te']); assert.ok(f.spoken.includes('te TE check'));
  await f.session.digit('3'); assert.ok(!f.spoken.some(x=>x.startsWith('ar ')&&x.endsWith('AR translation')));
  f.session.played(f.marks.at(-1)!); await f.session.digit('3'); assert.ok(f.spoken.some(x=>x.startsWith('ar ')&&x.endsWith('AR translation')));
  f.session.played(f.marks.at(-1)!); await f.turn('2'); f.session.played(f.marks.at(-1)!);
  await f.session.digit('3'); assert.deepEqual(f.stt,['te','ar']); assert.ok(f.spoken.includes('te TE translation'));
});
test('interruption invalidates a delayed translation and clears playback',async()=>{
  let complete!: (r:Result)=>void;
  let started!: () => void; const pendingStart = new Promise<void>(resolve=>{started=resolve;});
  const f=fixture({translate:async()=>{started();return new Promise(resolve=>{complete=resolve;});}});
  await f.consent(); const pending=f.turn('1'); await pendingStart; await f.session.digit('0');
  complete(ok); await pending; await f.session.digit('3');
  assert.ok(!f.spoken.some(x=>x.startsWith('ar ')&&x.endsWith('AR translation'))); assert.ok(f.cleared.length>0);
});
test('silence, excessive input and failed locks request another turn; emergencies exclusively hand off', async()=>{
  const f=fixture({translate:async()=>({...ok,locked_ok:false})});
  await f.consent(); await f.session.digit('1'); await f.session.media(Buffer.alloc(8000,255)); await f.session.digit('#');
  assert.deepEqual(f.stt,[]); await f.session.digit('1'); await f.session.media(Buffer.alloc(8000*25));
  assert.deepEqual(f.stt,[]); await f.turn('1'); assert.ok(!f.spoken.some(x=>x.startsWith('ar ')&&x.endsWith('AR translation')));
  const e=fixture({translate:async()=>({status:'emergency'})}); await e.consent(); await e.turn('1'); await e.turn('2');
  assert.deepEqual(e.stops,['handoff']); assert.equal(e.stt.length,1); assert.equal(e.spoken.length,2);
});
test('source codec silence and decoded WAV headers match Plivo media',()=>{
  const bytes = mulawFromPcm24k(Buffer.alloc(600)); assert.equal(bytes.length,100); assert.equal(hasVoice(bytes),false);
  assert.equal(hasVoice(Buffer.alloc(160,0)),true); const wav = wavFromMulaw(bytes);
  assert.equal(wav.readUInt32LE(24),8000); assert.equal(wav.readUInt32LE(40),200); assert.equal(wav.readInt16LE(44),0);
});
test('signed Plivo answer issues a single-use media stream and bilingual audio; signed human callback dials trusted destination',async t=>{
  const f=fixture(); const server=createInterpreter(cfg,()=>f.service);
  server.listen(0,'127.0.0.1');await once(server,'listening'); t.after(()=>server.close());
  const addr=server.address() as {port:number};const local='http://127.0.0.1:'+addr.port;
  const callback=(path:string,nonce:string)=> {
    const signature=createHmac('sha256','fixture').update(cfg.origin+path+'.'+nonce).digest('base64');
    return fetch(local+path,{headers:{'x-plivo-signature-v3':signature,'x-plivo-signature-v3-nonce':nonce}});
  };
  assert.equal((await fetch(local+'/answer')).status,403);
  const path='/answer?CallUUID=demo';
  const xml=await (await callback(path,'1')).text();
  const endpoint=xml.match(/\/media\/[a-f0-9]+/)![0]; assert.equal((await callback(path,'1')).status,403);
  const ws=new WebSocket(local.replace('http','ws')+endpoint);
  t.after(()=>ws.terminate()); await once(ws,'open');
  const first=once(ws,'message');
  ws.send(JSON.stringify({event:'start',start:{callId:'demo',streamId:'s',mediaFormat:{encoding:'audio/x-mulaw',sampleRate:8000}}}));
  assert.equal(JSON.parse(String((await first)[0])).event,'playAudio');
  const retry=new WebSocket(local.replace('http','ws')+endpoint); await once(retry,'error');
  assert.match(await (await callback('/human?CallUUID=demo','2')).text(),/<Dial [^>]*action="https:\/\/phone.example\/human-result"[^>]*><Number>/);
});
test('provider adapters upload decoded audio, check the danger gate, encode TTS and request the correct call transfer',async t=>{
  const calls:string[]=[];
  t.mock.method(globalThis,'fetch',async(url:string, init:RequestInit)=>{
    calls.push(url);
    if(url.endsWith('/stt')) {
      const form=init.body as FormData; assert.equal(form.get('language'),'ar');
      assert.equal((form.get('audio') as File).type,'audio/wav');return Response.json({text:'hi',status:'transcribed'});
    }
    if(url.endsWith('/translate')) return Response.json(ok);
    if(url.endsWith('/speech'))return new Response(new Uint8Array(24));
    assert.equal(JSON.parse(String(init.body)).aleg_method,'GET');return Response.json({message:'queued'});
  });
  const s=services(cfg,'example');assert.equal(await s.stt(Buffer.alloc(20,255),'ar'),'hi');
  assert.equal((await s.translate('నన్ను కొడుతున్నారు','te','ar')).status,'emergency');
  assert.equal(calls.length,1); await s.translate('hello','en','te');
  assert.equal((await s.speak('hello','en')).length,4); await s.handoff(); assert.equal(calls.length,4);
});

test('bound case gate suppresses a private phrase before read-back and blocks a missing case',async t=>{
  process.env.STORE='memory';
  const {default:express}=await import('express');
  const {registerVoiceTools}=await import('../server/voice-tools.ts');
  const {store}=await import('../server/store.ts');
  const previous=process.env.SAATHI_SECRET;process.env.SAATHI_SECRET='fixture';
  t.after(()=>{if(previous)process.env.SAATHI_SECRET=previous;else delete process.env.SAATHI_SECRET;});
  await store.addWorker({caseId:'GS-PHONE',phone:'+19999999999',consent:true,promise:{},codePhrase:'amma bagunda'});
  const app=express();app.use(express.json());registerVoiceTools(app,(_req,_res,next)=>next());
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>server.close());
  const backend='http://127.0.0.1:'+(server.address() as {port:number}).port;
  const bound=services({...cfg,backend},'id','GS-PHONE');
  const f=fixture({translate:bound.translate,stt:async()=>'amma bagunda'});
  await f.consent();await f.turn('1');
  assert.deepEqual(f.stops,[]);assert.equal(f.spoken.length,3);
  await assert.rejects(services({...cfg,backend},'id','GS-UNKNOWN').translate('hello','te','ar'));
});

test('a flagged amount is read back to its speaker and relayed only after key 3',async()=>{
  const calls:boolean[]=[];
  const f=fixture({stt:async()=>'ఐదు లక్షలు ఇవ్వలేదు',translate:async(_t,_f,_to,confirmed)=>{calls.push(!!confirmed);return confirmed?ok:{status:'needs_confirm'};}});
  await f.consent(); await f.turn('1');
  assert.ok(f.spoken.includes('te ఐదు లక్షలు ఇవ్వలేదు')); assert.ok(f.spoken.some(x=>x.startsWith('te సరైతే')));
  f.session.played(f.marks.at(-1)!); await f.session.digit('3');
  assert.deepEqual(calls,[false,true]); assert.ok(f.spoken.includes('te TE check'));
  await f.session.digit('3'); f.session.played(f.marks.at(-1)!); await f.session.digit('3');
  assert.ok(f.spoken.some(x=>x.startsWith('ar ')&&x.endsWith('AR translation')));
});
test('a correction replaces the flagged amount and is never sent confirmed',async()=>{
  const said=['ఐదు లక్షలు ఇవ్వలేదు','యాభై వేలు ఇవ్వలేదు']; const texts:string[]=[];
  const f=fixture({stt:async()=>said.shift()!,translate:async(t,_f,_to,c)=>{texts.push(t+(c?'!':''));return t.startsWith('ఐదు')?{status:'needs_confirm'}:ok;}});
  await f.consent(); await f.turn('1'); f.session.played(f.marks.at(-1)!); await f.turn('1');
  assert.deepEqual(texts,['ఐదు లక్షలు ఇవ్వలేదు','యాభై వేలు ఇవ్వలేదు']);
  await f.session.digit('3'); assert.ok(!f.spoken.some(x=>x.startsWith('ar ')&&x.endsWith('AR translation')));
});
test('a private phrase triggers a silent desk alert, no transfer and no confirmation',async()=>{
  const alerts:string[]=[];
  const f=fixture({translate:async()=>({status:'emergency',covert:true}),alert:async t=>{alerts.push(t);}});
  await f.consent(); await f.turn('1');
  assert.deepEqual(f.stops,[]); assert.deepEqual(alerts,['original']);
});
test('a failed transfer alerts the desk and keeps the worker on the line',async()=>{
  const alerts:string[]=[];
  const f=fixture({translate:async()=>({status:'emergency'}),handoff:async()=>{throw Error('x');},alert:async t=>{alerts.push(t);}});
  await f.consent(); await f.turn('1');
  assert.ok(f.spoken.some(x=>x.includes('కలపలేకపోయాను'))); assert.deepEqual(alerts,['original']); assert.ok(!f.stops.includes('close'));
});

function agentFixture(steps:AgentStep[],said:string[],over:Partial<AgentServices>={}) {
  const spoken:string[]=[],marks:string[]=[],stops:string[]=[];
  const service:AgentServices={stt:async()=>said.shift()??'',think:async()=>steps.shift()??{},check:async()=>'ok',
    speak:async(t,l)=>{spoken.push(l+' '+t);return Buffer.from([255]);},handoff:async()=>{stops.push('handoff');},...over};
  const session=new AgentSession('ar',service,{play:(_b,m)=>marks.push(m),clear:()=>{},close:()=>stops.push('close')},0);
  const turn=async()=>{await session.media(Buffer.alloc(4000,0));await session.media(Buffer.alloc(6000,255));session.played(marks.at(-1)!);};
  const begin=async()=>{await session.start();session.played(marks.at(-1)!);};
  return {session,spoken,marks,stops,turn,begin};
}
test('agent speaks for the worker, answers in the other language and reports back in Telugu',async()=>{
  const f=agentFixture([{say_to_other:'AR hello',say_to_worker:'సరే చెప్పాను'}],['టికెట్ కావాలి']);
  await f.begin(); assert.ok(f.spoken.some(x=>x.startsWith('te నమస్కారం'))); await f.turn();
  assert.ok(f.spoken.some(x=>x.startsWith('ar ')&&x.endsWith('AR hello'))); assert.ok(f.spoken.includes('te సరే చెప్పాను'));
});
test('agent never says a number nobody said and never answers an amount before the worker decides',async()=>{
  const f=agentFixture([{say_to_other:'I pay 500',say_to_worker:'సరే'},{say_to_other:'OK',say_to_worker:'వాళ్ళు 300 అన్నారు'}],['టికెట్ కావాలి','سعر التذكرة 300']);
  await f.begin(); await f.turn();
  assert.ok(!f.spoken.some(x=>x.includes('500'))); assert.ok(f.spoken.some(x=>x.startsWith('te ఈ సంఖ్య')));
  await f.turn(); assert.ok(!f.spoken.some(x=>x.startsWith('ar ')&&x.endsWith('OK'))); assert.ok(f.spoken.includes('te వాళ్ళు 300 అన్నారు'));
});
test('agent refuses a Telugu report that drops the other speaker number and asks them to repeat',async()=>{
  const f=agentFixture([{say_to_other:'AR hi',say_to_worker:'సరే'},{say_to_other:'',say_to_worker:'ఎక్కువ ధర'}],['టికెట్ కావాలి','سعر التذكرة 300']);
  await f.begin(); await f.turn(); await f.turn(); assert.ok(f.spoken.some(x=>x.startsWith('te వాళ్ళు చెప్పింది'))); assert.ok(f.spoken.some(x=>x.startsWith('ar ')&&x!=='ar OK'));
});
test('agent: private phrase is silent, emergency transfers, failed transfer keeps the line',async()=>{
  const alerts:string[]=[];
  const phrase='ఈ రోజు నేను మాట్లాడలేను';
  const c=agentFixture([],[phrase],{check:async()=>'covert',alert:async t=>{alerts.push(t);}});
  await c.begin(); await c.turn(); assert.deepEqual(alerts,[phrase]); assert.deepEqual(c.stops,[]); assert.equal(c.spoken.length,1);
  const e=agentFixture([],[phrase],{check:async()=>'emergency'}); await e.begin(); await e.turn(); assert.deepEqual(e.stops,['handoff']);
  const g=agentFixture([],[phrase],{check:async()=>'emergency',handoff:async()=>{throw Error('x');}}); await g.begin(); await g.turn();
  assert.ok(g.spoken.some(x=>x.includes('కలపలేకపోయాను'))); assert.ok(!g.stops.includes('close'));
});

test('Telugu speech uses Cartesia when a key is set and falls back to OpenAI; Telugu hearing prefers Sarvam',async t=>{
  const original=globalThis.fetch; const calls:string[]=[];
  t.after(()=>{globalThis.fetch=original;delete process.env.CARTESIA_API_KEY;});
  process.env.CARTESIA_API_KEY='fixture';
  globalThis.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{
    const url=String(input); calls.push(url);
    if(url.includes('cartesia')) return new Response(Buffer.alloc(600),{status:200});
    if(url.includes('openai.com')) return new Response(Buffer.alloc(600),{status:200});
    const model=(init?.body as FormData).get('model');
    return Response.json({status:'transcribed',text:model==='saaras:v3'?'సారం టెక్స్ట్':'ఓపెన్ టెక్స్ట్'});
  }) as typeof fetch;
  const {agentServices}=await import('../interpreter/providers.ts');
  const svc=agentServices(cfg,'call');
  assert.equal((await svc.speak('నమస్కారం','te')).length,100); assert.ok(calls.at(-1)!.includes('cartesia'));
  await svc.speak('hello','ar'); assert.ok(calls.at(-1)!.includes('openai.com'));
  assert.equal(await svc.stt(Buffer.alloc(80,0),''),'సారం టెక్స్ట్');
  globalThis.fetch=(async(input:RequestInfo|URL)=>String(input).includes('cartesia')?new Response('x',{status:500}):new Response(Buffer.alloc(600),{status:200})) as typeof fetch;
  assert.equal((await svc.speak('నమస్కారం','te')).length,100);   // Cartesia failed, OpenAI answered
});

test('agent opening is a short Telugu greeting; the AI notice goes to the other person once, with the first thing said to them',async()=>{
  const f=agentFixture([{say_to_other:'AR one',say_to_worker:''},{say_to_other:'AR two',say_to_worker:''}],['టికెట్ కావాలి','ఇంకొకటి కావాలి']);
  await f.begin();
  assert.deepEqual(f.spoken,['te నమస్కారం, నేను సాథి. చెప్పండి, ఏం కావాలి?']);
  assert.ok(!f.spoken.some(x=>/నొక్కండి|సున్నా|اضغط|press/i.test(x)));
  await f.turn(); const first=f.spoken.find(x=>x.endsWith('AR one'))!;
  assert.ok(first.startsWith('ar أنا مساعد'));
  await f.turn(); const second=f.spoken.find(x=>x.endsWith('AR two'))!;
  assert.equal(second,'ar AR two');
});


test('agent ignores noise, its own voice and speech from the other person before the worker has stated a goal',async()=>{
  const steps=[{say_to_other:'AR hello',say_to_worker:'వాళ్ళకు చెప్పాను'}];
  const f=agentFixture(steps,['Thank you.','سلام عليكم','టికెట్ కావాలి']);
  await f.begin(); const before=f.spoken.length;
  await f.turn(); await f.turn();                 // junk, then Arabic before any goal
  assert.equal(f.spoken.length,before); assert.equal(steps.length,1);
  await f.turn(); assert.ok(f.spoken.some(x=>x.startsWith('ar ')&&x.endsWith('AR hello')));    // the worker's Telugu goal starts the conversation
});
test('agent: short sound is ignored and a non-Telugu report to the worker is dropped',async()=>{
  const f=agentFixture([{say_to_other:'',say_to_worker:'I told them'}],['టికెట్ కావాలి']);
  await f.begin(); const before=f.spoken.length;
  await f.session.media(Buffer.alloc(800,0)); await f.session.media(Buffer.alloc(6000,255)); assert.equal(f.spoken.length,before);
  await f.turn(); assert.ok(!f.spoken.some(x=>x.includes('I told them')));
});

test('caller can interrupt the opening: sustained voice clears our audio and is heard',async()=>{
  const said=['టికెట్ కావాలి']; const cleared:string[]=[]; const marks:string[]=[]; const spoken:string[]=[];
  const service:AgentServices={stt:async()=>said.shift()??'',think:async()=>({say_to_other:'AR hi',say_to_worker:''}),check:async()=>'ok',
    speak:async(t,l)=>{spoken.push(l+' '+t);return Buffer.from([255]);},handoff:async()=>{}};
  const session=new AgentSession('ar',service,{play:(_b,m)=>marks.push(m),clear:()=>cleared.push('clear'),close:()=>{}},0);
  await session.start();                                   // opening is playing; no played() ack yet
  for(let i=0;i<30;i++) await session.media(Buffer.alloc(160,0));   // 0.6 s of voice over our speech
  assert.equal(cleared.length,1);
  await session.media(Buffer.alloc(6000,255));            // silence ends the turn
  assert.ok(spoken.some(x=>x.startsWith('ar ')&&x.endsWith('AR hi')));
});
test('if Plivo never confirms playback the agent still starts listening',async()=>{
  const said=['టికెట్ కావాలి']; const marks:string[]=[]; const spoken:string[]=[];
  const service:AgentServices={stt:async()=>said.shift()??'',think:async()=>({say_to_other:'AR hi',say_to_worker:''}),check:async()=>'ok',
    speak:async(t,l)=>{spoken.push(l+' '+t);return Buffer.alloc(0);},handoff:async()=>{}};
  const session=new AgentSession('ar',service,{play:(_b,m)=>marks.push(m),clear:()=>{},close:()=>{}},0);
  await session.start(); await new Promise(r=>setTimeout(r,3100));       // empty audio: fallback fires after 3 s
  await session.media(Buffer.alloc(4000,0)); await session.media(Buffer.alloc(6000,255));
  assert.ok(spoken.some(x=>x.startsWith('ar ')&&x.endsWith('AR hi')));
});

test('non-Telugu speech is heard again with the target-language hint and Sarvam text is not used for it',async t=>{
  const original=globalThis.fetch; const langs:string[]=[];
  t.after(()=>{globalThis.fetch=original;});
  globalThis.fetch=(async(_input:RequestInfo|URL,init?:RequestInit)=>{
    const form=init?.body as FormData; const model=String(form.get('model')); const language=String(form.get('language'));
    langs.push(model+':'+language);
    if(model==='saaras:v3') return Response.json({status:'transcribed',text:'తెలుగు గందరగోళం'});
    return Response.json({status:'transcribed',text:language==='ar'?'مرحبا كيف حالك':'اردو غلط'});
  }) as typeof fetch;
  const {agentServices}=await import('../interpreter/providers.ts');
  const svc=agentServices(cfg,'call');
  assert.equal(await svc.stt(Buffer.alloc(80,0),''),'مرحبا كيف حالك');
  assert.ok(langs.includes('gpt-4o-transcribe:ar'));
});
