import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { registerVoiceTools } from '../server/voice-tools.ts';
import { store } from '../server/store.ts';
import { findPlace,voiceDirections } from '../server/voice-maps.ts';
import {relay} from '../server/relay.ts';
test('landmark results have provider identities, straight-line distances and Telugu pronunciation',async t=>{
  process.env.GOOGLE_MAPS_API_KEY='fixture';
  t.after(()=>{delete process.env.GOOGLE_MAPS_API_KEY;});
  const place=(id:string,name:string,n:number)=>({id,displayName:{text:name},location:{latitude:25+n,longitude:55}});
  const mock=t.mock.method(globalThis,'fetch',async(_url:unknown,init:RequestInit)=>{
    const b=JSON.parse(String(init.body));
    return Response.json({places:b.locationBias?[place('ChIJ01','City Pharmacy',.01)]:[place('ChIJ02','Clock Tower',0)]});
  });
  assert.equal((await findPlace('pharmacy','Dubai','pharmacy')).status,'needs_landmark');
  assert.equal((await findPlace('Clock Tower daggara','Dubai','embassy')).status,'official');
  assert.equal(mock.mock.callCount(),0);
  const result=await findPlace('Clock Tower daggara','Dubai','pharmacy');
  assert.ok('places' in result && result.places);
  assert.equal(result.places[0].distance_m,1112);
  assert.match(result.places[0].name_te,/[ఁ-౿]/);
  mock.mock.mockImplementation(async()=>Response.json({places:[]}));
  assert.equal((await findPlace('Clock Tower daggara','Dubai','pharmacy')).status,'needs_landmark');
});
test('walking and transit directions: short Telugu instructions or a destination-specific taxi line',async t=>{
  process.env.GOOGLE_MAPS_API_KEY='fixture';
  t.after(()=>{delete process.env.GOOGLE_MAPS_API_KEY;});
  const mock=t.mock.method(globalThis,'fetch',async(url:string)=>{
    assert.match(url,/mode=walking/);assert.match(url,/language=te/);
    return Response.json({status:'OK',routes:[{legs:[{steps:Array(5).fill({html_instructions:'<b>ఎడమవైపు తిరగండి</b>'})}]}]});
  });
  const r=await voiceDirections('Clock Tower daggara','Dubai','Station','walking');assert.ok('steps' in r);assert.equal(r.steps.length,4);assert.ok(r.more_steps);
  mock.mock.mockImplementation(async()=>Response.json({status:'ZERO_RESULTS'}));
  const fallback=await voiceDirections('Clock Tower daggara','Dubai','Station','transit');assert.ok('taxi_ar' in fallback);assert.match(String(fallback.taxi_ar),/Station/);
});
test('guarded phone routes prioritize danger, support both relay legs and send only to the confirmed case contact',async t=>{
  process.env.STORE='memory';process.env.SAATHI_SECRET='fixture';delete process.env.OPENAI_API_KEY;
  await store.addWorker({caseId:'GS-VOICE',phone:'+919000000001',familyPhone:'+919000000002',consent:true,promise:{},codePhrase:'amma bagunda'});
  const app=express();app.use(express.json());
  registerVoiceTools(app,(req,res,next)=>req.get('x-saathi-secret')==='fixture'?next():void res.sendStatus(401));
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>{server.close();});
  const local=globalThis.fetch;
  const post=(path:string,b:object)=>local('http://127.0.0.1:'+(server.address() as AddressInfo).port+path,{method:'POST',headers:{'x-saathi-secret':'fixture','content-type':'application/json'},body:JSON.stringify(b)});
  for(const path of ['/api/translate','/tools/translate','/tools/find-place','/tools/directions','/tools/send-place-sms']){
    const r=await (await post(path,{case_id:'GS-VOICE',caller_said:'amma bagunda',text:'amma bagunda'})).json();
    assert.equal(r.status,'emergency');assert.equal(r.say_to_other,'');
  }
  assert.equal((await (await post('/tools/translate',{other_said:'يضربني',target_lang:'ar'})).json()).status,'emergency');
  assert.equal((await post('/tools/translate',{other_said:'Hello',caller_said:'Hello',target_lang:'en'})).status,400);
  assert.equal((await post('/api/translate',{text:'Hello',from:'xx',to:'te'})).status,400);
  assert.equal((await (await post('/tools/translate',{other_said:'أعترف',target_lang:'ar'})).json()).status,'escalate_human');
  const b={case_id:'GS-VOICE',caller_said:'send it',place_id:'mission:Dubai',recipient:'family',confirmed:true};
  delete process.env.MSG91_PLACE_TEMPLATE_ID;
  assert.equal((await (await post('/tools/send-place-sms',b)).json()).status,'dry-run');
  process.env.MSG91_AUTH_KEY='fixture';process.env.MSG91_PLACE_TEMPLATE_ID='place-template';
  t.after(()=>{delete process.env.MSG91_AUTH_KEY;delete process.env.MSG91_PLACE_TEMPLATE_ID;});
  const mock=t.mock.method(globalThis,'fetch',async(_url:unknown,init:RequestInit)=>{
    const body=JSON.parse(String(init.body));assert.equal(body.template_id,'place-template');
    assert.equal(body.recipients[0].mobiles,'919000000002');assert.match(body.recipients[0].maps_link,/^https:\/\/www.google.com\/maps/);
    return Response.json({type:'success'});
  });
  assert.equal((await post('/tools/send-place-sms',{...b,confirmed:false})).status,400);
  assert.equal((await (await post('/tools/send-place-sms',b)).json()).status,'accepted');assert.equal(mock.mock.callCount(),1);
});
test('inbound Arabic and low-confidence model replies',async t=>{
  process.env.OPENAI_API_KEY='fixture';t.after(()=>{delete process.env.OPENAI_API_KEY;});
  let confidence='high';const mock=t.mock.method(globalThis,'fetch',async()=>Response.json({choices:[{message:{content:JSON.stringify({safety:'ordinary',confidence,text:'నమస్కారం'})}}]}));
  assert.equal((await relay('مرحبا','ar','te')).say_to_worker,'నమస్కారం');assert.equal(mock.mock.callCount(),1);
  confidence='low';const r=await relay('నాకు తిండి కావాలి','te','ar');assert.equal(r.status,'needs_confirm');assert.ok('fixed_phrase' in r);
});

test('Telugu-script landmarks and loose place kinds from real Bolna calls are understood',async()=>{
  const {extractAnchor}=await import('../server/assistant.ts');
  const {normalizeKind,bareLandmark}=await import('../server/voice-maps.ts');
  assert.equal(extractAnchor('అవునండి. దుబాయ్ మాల్.').anchor,'Dubai Mall');
  assert.equal(extractAnchor('బుర్జ్ ఖాలీఫా').anchor,'Burj Khalifa');
  assert.equal(normalizeKind('Pharmacy'),'pharmacy');
  assert.equal(normalizeKind('మందుల షాపు'),'pharmacy');
  assert.equal(normalizeKind('xyz'),undefined);
  assert.equal(bareLandmark('అవునండి','Dubai'),undefined);
  assert.equal(bareLandmark('pharmacy','Dubai'),undefined);
  assert.ok(bareLandmark('అల్ ఖుసైస్ మెట్రో','Dubai'));
});
