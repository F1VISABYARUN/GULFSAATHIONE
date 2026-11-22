import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createHmac } from 'node:crypto';
import { WebSocket } from 'ws';
import { createInterpreter } from '../interpreter/server.ts';
import { PhoneSession, type Services, type Result } from '../interpreter/session.ts';
import { hasVoice, wavFromMulaw, mulawFromPcm24k } from '../interpreter/media.ts';
import { services } from '../interpreter/providers.ts';

const cfg = {origin:'https://phone.example',backend:'https://api.example',secret:'fixture',authId:'fixture',
  authToken:'fixture',human:'+19999999999',openai:'fixture',target:'ar'};
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
  await f.session.digit('3'); assert.ok(!f.spoken.includes('ar AR translation'));
  f.session.played(f.marks.at(-1)!); await f.session.digit('3'); assert.ok(f.spoken.includes('ar AR translation'));
  f.session.played(f.marks.at(-1)!); await f.turn('2'); f.session.played(f.marks.at(-1)!);
  await f.session.digit('3'); assert.deepEqual(f.stt,['te','ar']); assert.ok(f.spoken.includes('te TE translation'));
});
test('interruption invalidates a delayed translation and clears playback',async()=>{
  let complete!: (r:Result)=>void;
  let started!: () => void; const pendingStart = new Promise<void>(resolve=>{started=resolve;});
  const f=fixture({translate:async()=>{started();return new Promise(resolve=>{complete=resolve;});}});
  await f.consent(); const pending=f.turn('1'); await pendingStart; await f.session.digit('0');
  complete(ok); await pending; await f.session.digit('3');
  assert.ok(!f.spoken.includes('ar AR translation')); assert.ok(f.cleared.length>0);
});
test('silence, excessive input and failed locks request another turn; emergencies exclusively hand off', async()=>{
  const f=fixture({translate:async()=>({...ok,locked_ok:false})});
  await f.consent(); await f.session.digit('1'); await f.session.media(Buffer.alloc(8000,255)); await f.session.digit('#');
  assert.deepEqual(f.stt,[]); await f.session.digit('1'); await f.session.media(Buffer.alloc(8000*25));
  assert.deepEqual(f.stt,[]); await f.turn('1'); assert.ok(!f.spoken.includes('ar AR translation'));
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
  assert.match(await (await callback('/human?CallUUID=demo','2')).text(),/<Dial><Number>/);
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
  assert.deepEqual(f.stops,['handoff']);assert.equal(f.spoken.length,2);
  await assert.rejects(services({...cfg,backend},'id','GS-UNKNOWN').translate('hello','te','ar'));
});
