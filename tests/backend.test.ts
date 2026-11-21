import test from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../server/store.ts';
import { applyToWorker } from '../server/saathi.ts';
import { familyMessage, familyProvider } from '../server/family-sms.ts';
process.env.STORE = 'memory';
test('tool/webhook overlap reserves one neutral family notification', async () => {
  const caseId = 'GS-TEST';
  await store.addWorker({caseId,phone:'unknown',familyPhone:'+919000000000',promise:{},consent:true});
  let sends = 0;
  const sms = {send: async () => { sends++; return 'accepted' as const; }};
  await Promise.all([1,2].map(() => applyToWorker(caseId,{passportHeld:true},'checkin',undefined,sms)));
  assert.equal(sends,1);
  assert.equal((await store.worker(caseId))?.familySms?.status,'accepted');
  assert.equal(familyMessage(caseId),'మీ కుటుంబ సభ్యుని కేసు GS-TEST నమోదైంది. సాథి మనిషి మీకు కాల్ చేస్తారు.');
});
test('MSG91 needs a successful application response; missing config is dry run', async t => {
  delete process.env.MSG91_AUTH_KEY;
  assert.equal(await familyProvider().send('',''), 'dry-run');
  process.env.MSG91_AUTH_KEY='fixture'; process.env.MSG91_TEMPLATE_ID='template';
  t.after(()=>{delete process.env.MSG91_AUTH_KEY; delete process.env.MSG91_TEMPLATE_ID;});
  const mock=t.mock.method(globalThis,'fetch',async (_url: unknown,init: RequestInit) => {
    assert.deepEqual(JSON.parse(String(init.body)),{template_id:'template',recipients:[{mobiles:'919000000000',case_id:'GS-TEST'}]});
    return Response.json({type:'success'});
  });
  assert.equal(await familyProvider().send('+919000000000','GS-TEST'),'accepted');
  mock.mock.mockImplementation(async()=>Response.json({type:'error'}));
  assert.equal(await familyProvider().send('+919000000000','GS-TEST'),'failed');
});

import express from 'express';
import type { AddressInfo } from 'node:net';
import type { TestContext } from 'node:test';
import { once } from 'node:events';
import { registerSaathi } from '../server/saathi.ts';
async function api(t: TestContext) {
  process.env.SAATHI_SECRET='fixture';
  const app=express(); app.use(express.json());
  registerSaathi(app,(req,res,next)=>req.get('x-saathi-secret')==='fixture'?next():void res.sendStatus(401));
  const server=app.listen(0,'127.0.0.1'); await once(server,'listening');
  t.after(()=>{server.close();});
  return (path:string, body?:object, auth=true)=>fetch('http://127.0.0.1:'+ (server.address() as AddressInfo).port+'/api/saathi/cases'+path,{
    method:body?'POST':'GET',headers:{'content-type':'application/json','x-saathi-secret':auth?'fixture':''},body:body?JSON.stringify(body):undefined});
}
test('caseworker filters, notes and idempotent closure',async t=>{
  const request=await api(t);
  const id='GS-WORK';
  await store.addWorker({caseId:id,promise:{},phone:'unknown',consent:true});
  await store.updateWorker(id,{status:'alert',riskLevel:'high'});
  for(const [path,body] of [['',undefined],['/'+id+'/note',{note:'n'}],['/'+id+'/close',{outcome:'solved'}]] as const)
    assert.equal((await request(path,body,false)).status,401);
  assert.ok((await (await request('?level=high&status=alert')).json()).some((w: {caseId:string})=>w.caseId===id));
  assert.equal((await request('/'+id+'/note',{note:' '})).status,400);
  assert.equal((await request('/'+id+'/note',{note:'Reached worker'})).status,201);
  assert.equal((await request('/'+id+'/close',{outcome:'bad'})).status,400);
  const close=()=>request('/'+id+'/close',{outcome:'partly'});
  assert.deepEqual(await (await close()).json(),await (await close()).json());
  assert.equal((await request('/'+id+'/close',{outcome:'not'})).status,409);
  assert.equal((await request('/missing/note',{note:'ok'})).status,404);
});
import { isOverdue } from '../server/saathi.ts';
test('overdue starts at escalation, restarts on a note and stops on closure',async()=>{
  const w=await store.addWorker({caseId:'GS-CLOCK',phone:'unknown',promise:{},consent:true});
  const start=Date.UTC(2026,1,1), day=86400000;
  const alert={...w,riskLevel:'high' as const,alertSince:new Date(start).toISOString()};
  assert.equal(isOverdue(alert,start+day-1),false);
  assert.equal(isOverdue(alert,start+day),true);
  assert.equal(isOverdue({...alert,notes:[{at:new Date(start+day).toISOString(),text:'contacted'}]},start+day),false);
  assert.equal(isOverdue({...alert,status:'closed'},start+day),false);
});
test('case file uses worker promise and caller speech only',async t=>{
  const request=await api(t), id='GS-FILE';
  await store.addWorker({caseId:id,name:'Worker',phone:'unknown',consent:true,promise:{job:'cleaner'}});
  await store.addCall({caseId:id,id:'a',kind:'arrival',at:new Date().toISOString(),status:'answered',reasons:[],transcript:'assistant: passport teeskunnaru\nuser: hello'});
  assert.equal((await request('/'+id+'/file',undefined,false)).status,401);
  assert.equal((await request('/missing/file')).status,404);
  const f=await (await request('/'+id+'/file')).json();
  assert.equal(f.promise.job,'cleaner'); assert.equal(f.id,id);
  assert.equal(f.timeline[0].heard,'hello'); assert.equal(f.timeline[0].callId,'a');
});
import { placeCall } from '../server/saathi.ts';
test('Bolna queues a documented make-call payload and validates its receipt',async t=>{
  const d={caseId:'GS-CALL',phone:'+919000000000',kind:'retry' as const};
  await store.addWorker({...d,promise:{job:'cleaner'},consent:true});
  delete process.env.BOLNA_API_KEY;
  const mock=t.mock.method(globalThis,'fetch',async(url:unknown,init:RequestInit)=>{
    assert.equal(url,'https://api.bolna.ai/call');
    assert.equal(init.method,'POST');
    assert.equal(new Headers(init.headers).get('authorization'),'Bearer fixture');
    const body=JSON.parse(String(init.body));
    assert.equal(body.agent_id,'agent');assert.equal(body.recipient_phone_number,d.phone);
    assert.equal(body.user_data.case_id,d.caseId);assert.equal(body.user_data.call_kind,'retry');
    return Response.json({execution_id:'exec'});
  });
  assert.equal((await placeCall(d)).placed,false);assert.equal(mock.mock.callCount(),0);
  process.env.BOLNA_API_KEY='fixture';process.env.BOLNA_CHECKIN_AGENT_ID='agent';
  t.after(()=>{delete process.env.BOLNA_API_KEY;delete process.env.BOLNA_CHECKIN_AGENT_ID;});
  const queued=await placeCall(d); assert.ok('execution_id' in queued); assert.equal(queued.execution_id,'exec');
  mock.mock.mockImplementation(async()=>Response.json({error:'invalid'},{status:400}));
  assert.equal((await placeCall(d)).placed,false);
  assert.equal((await placeCall({...d,phone:'000'})).placed,false);
});
test('translation in either direction is withheld until a human approves the edited wording',async t=>{
  const request=await api(t),id='GS-LANG';
  await store.addWorker({caseId:id,phone:'unknown',consent:true,promise:{}});
  const old=process.env.OPENAI_API_KEY; delete process.env.OPENAI_API_KEY;
  t.after(()=>{if(old)process.env.OPENAI_API_KEY=old;});
  for(const from of ['ar','te']){
    const base='/'+id+'/translations';
    const entry=await (await request(base,{from,text:'source message'})).json();
    assert.equal(entry.status,'pending_review');assert.equal(entry.draft,undefined);
    const item=base+'/'+entry.id;
    assert.equal((await request(item+'/reply')).status,202);
    assert.equal((await request(item+'/approve',{text:'checked',reviewer:'Reviewer'},false)).status,401);
    assert.equal((await request(item+'/approve',{text:'checked',reviewer:'Reviewer'})).status,200);
    assert.deepEqual(await (await request(item+'/reply')).json(),{status:'approved',language:from==='te'?'ar':'te',text:'checked'});
  }
});
