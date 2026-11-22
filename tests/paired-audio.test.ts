import test from 'node:test';
import assert from 'node:assert/strict';
import { pairedAudio, type Clip, type Trial } from '../eval/reliability/paired-audio.ts';
import { replayRecording } from '../eval/e2e/replay-client.ts';

const c:Clip={id:'c1',call:'call1',dataset:'family',direction:'te-ar',speaker:'s1',speakerVerified:true,status:'verified',split:'dev',
  question:'మీ పాస్‌పోర్ట్ మీ దగ్గర ఉందా?',truth:{passportHeld:{state:'reported',value:true}}};
const t:Trial={clip:'c1',model:'a',run:1,text:'లేదు',ms:10};
const listener={reviewer:'r',audioId:'blind-1',direction:'te-ar',facts:{},warned:[],firstAudioDelayMs:620};
test('paired verified cohorts; repeated speech does not increase primary counts; playback requires a listener',()=>{
  const other={...c,id:'c2',speaker:'s2',call:'call2'};
  const trials=[{...t,listener},{...t,model:'b',ms:50},{...t,text:'changed',run:2},{...t,clip:'c2'},
    {clip:'c2',run:1,model:'b',error:'upstream timeout'},{...t,run:3,text:undefined,error:'timeout'}];
  const g=pairedAudio([c,other],trials,['a','b'],'dev').groups[0];
  assert.equal(g.eligibleClips,2);assert.equal(g.pairedClips,1);assert.equal(g.verifiedPairedSpeakers,1);
  assert.equal(g.systems[1].failed,1);
  const a=g.systems[0];
  assert.equal(a.base.criticalFacts.count,0);assert.equal(a.saathi.criticalFacts.count,1);
  assert.equal(a.repeatTranscriptChanged.total,1);assert.equal(a.repeatTranscriptChanged.count,1);assert.equal(a.repeatErrors,1);
  assert.equal(a.reviewedPlayback.silentMiss.rate,null);assert.deepEqual(a.providerMs,{n:1,p50:10,p95:10});
  const reviewed=pairedAudio([c],[{...t,listener},{...t,model:'b',listener:{...listener,warned:['passportHeld']}}],['a','b'],'dev').groups[0];
  assert.equal(reviewed.pairedPlaybackReviews,1);
  assert.equal(reviewed.systems[0].reviewedPlayback.silentMiss.rate,1);
  assert.equal(reviewed.systems[1].reviewedPlayback.silentMiss.rate,0);
  assert.equal(reviewed.systems[1].reviewedPlayback.criticalFacts.rate,0);
  assert.equal(reviewed.systems[1].reviewedPlayback.endOfSpeechToFirstAudioMs.p95,620);
});
test('refuses split leakage, duplicate observations, stale directions and invalid timing',()=>{
  assert.throws(()=>pairedAudio([c,{...c,id:'c2',call:'other',split:'heldout'}],[],['a'],'dev'),/leakage/);
  assert.throws(()=>pairedAudio([c],[t,t],['a'],'dev'),/duplicate/);
  assert.throws(()=>pairedAudio([c],[{...t,listener:{...listener,direction:'ar-te'}}],['a'],'dev'),/review/);
  assert.throws(()=>pairedAudio([c],[{...t,ms:-1}],['a'],'dev'),/timing/);
  assert.equal(pairedAudio([c],[],['a'],'heldout').verified,0);
  assert.throws(()=>pairedAudio([{...c,split:'heldout',speakerVerified:false}],[],['a'],'heldout'),/identity/);
});
test('replay sends source language only, rejects incomplete transcription responses',async t=>{
  const url=new URL('http://localhost/api/saathi/stt');
  let model='a';
  t.mock.method(globalThis,'fetch',async (_url:URL,options:{body:FormData})=>{
    assert.equal(options.body.get('language'),'te');
    assert.equal(options.body.get('model'),'a');
    return Response.json({text:'లేదు',model,ms:15});
  });
  const invoke=()=>replayRecording(new Blob(['wav']),'clip.wav','te','a','fixture',url);
  assert.equal((await invoke()).text,'లేదు');
  model='b'; await assert.rejects(invoke,/Invalid/);
});

import { execFileSync } from 'node:child_process';
import { mkdtempSync,readFileSync,writeFileSync,rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('blind review round trip omits provider identity and frozen values, attaches only verified audio',ctx=>{
  const d=mkdtempSync(join(tmpdir(),'saathi-listener-'));ctx.after(()=>rmSync(d,{recursive:true,force:true}));
  const labels=join(d,'clips.json'),trials=join(d,'trials.jsonl'),dir=join(d,'round'),dest=join(d,'reviewed.jsonl');
  writeFileSync(labels,JSON.stringify([{...c,audio:'source.wav'}]));
  writeFileSync(join(d,'source.wav'),'src');writeFileSync(join(d,'private-model-name.wav'),'translation');
  writeFileSync(trials,JSON.stringify({...t,model:'private-model-name',playback:'private-model-name.wav'}));
  const run=(mode:string,...extra:string[])=>execFileSync(process.execPath,['--import','tsx','eval/reliability/listener-review.ts',mode,labels,trials,dir,...extra],{stdio:'pipe'});
  run('init');
  const sheet=join(dir,'reviewer','worksheet.json');
  const content=readFileSync(sheet,'utf8');assert.ok(!content.includes('private-model-name'));assert.ok(!content.includes('truth'));
  const [row]=JSON.parse(content);assert.equal(readFileSync(join(dir,'reviewer',row.file),'utf8'),'translation');
  assert.equal(readFileSync(join(dir,'reviewer',row.clipSource),'utf8'),'src');
  Object.assign(row,{status:'verified',reviewer:'native-speaker',facts:{passportHeld:true}});
  writeFileSync(sheet,JSON.stringify([row]));run('join',dest);
  const observed=JSON.parse(readFileSync(dest,'utf8'));assert.equal(observed.listener.audioId,row.audioId);
  assert.equal(pairedAudio([c],[observed],['private-model-name'],'dev').groups[0].systems[0].reviewedPlayback.criticalFacts.rate,1);
  assert.throws(()=>run('join',dest),/EEXIST/);
});

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';

test('manifest replay binds exact audio and leaves failed and successful attempts comparable',async ctx=>{
  const d=mkdtempSync(join(tmpdir(),'saathi-replay-'));ctx.after(()=>rmSync(d,{recursive:true,force:true}));
  const labels=join(d,'clips.json'),dest=join(d,'round.jsonl');
  writeFileSync(join(d,'source.wav'),'clip contents');
  const digest=createHash('sha256').update('clip contents').digest('hex');
  const manifest=[{...c,audio:'source.wav',sha256:digest}];writeFileSync(labels,JSON.stringify(manifest));
  const server=createServer(async (req,res)=>{
    const chunks=[];for await (const chunk of req) chunks.push(chunk);
    const body=Buffer.concat(chunks).toString();
    assert.ok(body.includes('clip contents'));assert.ok(!body.includes('passportHeld'));
    assert.equal(req.headers['x-saathi-secret'],'fixture');
    if (body.includes('gemini-2.5-flash')) {res.writeHead(503);res.end(JSON.stringify({error:'Unavailable'}));}
    else res.end(JSON.stringify({model:'gpt-4o-transcribe',ms:13,text:'లేదు'}));
  }).listen(0,'127.0.0.1');
  await once(server,'listening');ctx.after(()=>server.close());
  const run=(destination:string)=>promisify(execFile)(process.execPath,['--import','tsx','eval/reliability/replay-audio.ts',labels,destination,'dev','gpt-4o-transcribe','gemini-2.5-flash'],
    {env:{...process.env,STT_RUNS:'2',SAATHI_SECRET:'fixture',SAATHI_URL:'http://127.0.0.1:'+(server.address() as AddressInfo).port}});
  await assert.rejects(run(dest));
  const rows=readFileSync(dest,'utf8').trim().split('\n').map(line=>JSON.parse(line));assert.equal(rows.length,4);
  assert.equal(rows[0].ms,13);assert.match(rows[1].error,/Unavailable/);
  manifest[0].sha256='changed';writeFileSync(labels,JSON.stringify(manifest));
  await assert.rejects(run(join(d,'second.jsonl')),/digest mismatch/);
});
