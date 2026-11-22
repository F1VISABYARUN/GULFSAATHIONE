import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import { familyProvider } from '../server/family-sms.ts';
import { backend, store } from '../server/store.ts';
import { applyToWorker, isOverdue, registerSaathi } from '../server/saathi.ts';

test('shared-phone call review requires authentication for HTML, recordings, writes and results', async t => {
  process.env.VERCEL = '1'; // import the app without opening the production listener
  const { default: app } = await import('../server/index.ts');
  const srv = app.listen(0, '127.0.0.1');
  await once(srv, 'listening');
  t.after(() => { srv.close(); delete process.env.VERCEL; delete process.env.SAATHI_SECRET; });
  const base = 'http://127.0.0.1:' + (srv.address() as AddressInfo).port;
  delete process.env.SAATHI_SECRET;
  assert.equal((await fetch(base + '/facts.html')).status, 503);
  process.env.SAATHI_SECRET = 'fixture';
  for (const path of ['/facts.html','/audio/bolna/missing.mp3','/api/bolna/calls','/api/bolna/casefile/missing','/api/results/bolna']) {
    const res = await fetch(base + path);
    assert.equal(res.status, 401, path);
    assert.match(res.headers.get('cache-control')!, /no-store/);
  }
  assert.equal((await fetch(base + '/api/bolna/facts/00000000', {method:'POST'})).status, 401);
  const authorization = 'Basic ' + Buffer.from('review:fixture').toString('base64');
  assert.equal((await fetch(base + '/facts.html', {headers:{authorization}})).status, 200);
  assert.equal((await fetch(base + '/audio/bolna/missing.mp3', {headers:{'x-saathi-secret':'fixture'}})).status, 404);
  assert.equal((await fetch(base + '/api/bolna/facts/00000000', {method:'POST',headers:{authorization,'sec-fetch-site':'cross-site'}})).status, 403);
  for (const key of ['KV_REST_API_URL','KV_REST_API_TOKEN','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN']) delete process.env[key];
  process.env.STORE='memory';
  assert.equal((await fetch(base + '/api/saathi/cases', {headers:{'x-saathi-secret':'fixture'}})).status,503);
  process.env.UPSTASH_REDIS_REST_URL='https://storage.example';
  process.env.UPSTASH_REDIS_REST_TOKEN='fixture';
  assert.equal(backend(),'redis');
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

test('an alert survives restart with one accepted SMS, a real desk acknowledgement and a checked receipt',async t=>{
  const folder=mkdtempSync(join(tmpdir(),'saathi-ops-'));
  process.env.SAATHI_CASE_FILE=join(folder,'cases.json');
  process.env.SAATHI_SECRET='fixture';
  delete process.env.STORE;
  delete process.env.VERCEL;
  t.after(()=>{rmSync(folder,{recursive:true,force:true});delete process.env.SAATHI_CASE_FILE;delete process.env.SAATHI_SECRET;});
  const app=express();
  app.use(express.json());
  registerSaathi(app,(req,res,next)=>req.get('x-saathi-secret')==='fixture'?next():void res.sendStatus(401));
  const srv=app.listen(0,'127.0.0.1'); await once(srv,'listening');
  t.after(()=>{srv.close();});
  const url='http://127.0.0.1:'+(srv.address() as AddressInfo).port+'/api/saathi/cases/GS-OPS';
  const send=(path:string,body:object)=>fetch(url+path,{method:'POST',headers:{'content-type':'application/json','x-saathi-secret':'fixture'},body:JSON.stringify(body)});
  await store.addWorker({caseId:'GS-OPS',promise:{},phone:'unknown',familyPhone:'+919000000000',consent:true});
  let sends=0;
  process.env.MSG91_AUTH_KEY='fixture'; process.env.MSG91_TEMPLATE_ID='template';
  t.after(()=>{delete process.env.MSG91_AUTH_KEY;delete process.env.MSG91_TEMPLATE_ID;});
  const originalFetch=globalThis.fetch;
  t.mock.method(globalThis,'fetch',async(input:Parameters<typeof fetch>[0],init?:RequestInit)=>{
    if(String(input)!=='https://control.msg91.com/api/v5/flow/') return originalFetch(input,init);
    sends++;
    assert.deepEqual(JSON.parse(String(init?.body)),{template_id:'template',recipients:[{mobiles:'919000000000',case_id:'GS-OPS'}]});
    return Response.json({type:'success',message:'request_123'});
  });
  await Promise.all([1,2].map(()=>applyToWorker('GS-OPS',{passportHeld:true},'checkin',undefined,familyProvider(),false,undefined,'execution-1')));
  assert.equal((await store.calls('GS-OPS')).length,1);
  assert.equal(sends,1);
  const pending=await store.worker('GS-OPS');
  assert.equal(pending?.familySms?.status,'accepted');
  assert.equal(pending?.acknowledged,undefined);
  const acknowledge=()=>send('/acknowledge',{caseworker:'Reviewer'});
  const first=await (await acknowledge()).json();
  assert.equal(first.by,'Reviewer');assert.deepEqual(await (await acknowledge()).json(),first);
  assert.equal((await send('/acknowledge',{caseworker:'Other reviewer'})).status,409);
  const receipt={caseworker:'Reviewer',status:'delivered',providerId:'request_123'};
  assert.equal((await send('/family-sms/delivery',{...receipt,providerId:'wrong'})).status,409);
  const recorded=await (await send('/family-sms/delivery',receipt)).json();
  assert.equal(recorded.status,'delivered');assert.equal(recorded.deliveryCheck.by,'Reviewer');
  assert.deepEqual(await (await send('/family-sms/delivery',receipt)).json(),recorded);
  assert.equal((await send('/family-sms/delivery',{...receipt,status:'failed'})).status,409);
  const restarted=execFileSync(process.execPath,['--import','tsx','--input-type=module','-e',
    "import {store} from './server/store.ts'; console.log(JSON.stringify(await store.worker('GS-OPS')))"],{encoding:'utf8'});
  const row=JSON.parse(restarted);assert.deepEqual(row.acknowledged,first);assert.deepEqual(row.familySms,recorded);
  const later=Date.parse(row.alertSince)+86400001;
  assert.equal(isOverdue({...row,notes:[{source:'system',at:new Date(later).toISOString(),text:'auto'}]},later),true);
});
