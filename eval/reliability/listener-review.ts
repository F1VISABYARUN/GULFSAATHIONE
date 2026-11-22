import { randomInt,randomUUID } from 'node:crypto';
import { copyFileSync,mkdirSync,readFileSync,writeFileSync } from 'node:fs';
import { dirname,extname,join,resolve } from 'node:path';
import { type Clip, pairedAudio, type Trial } from './paired-audio.ts';

type RecordingTrial = Trial & { playback?:string };
type Review = NonNullable<Trial['listener']>;
type ReviewRow = Review & {status:'pending'|'verified';file:string; clipSource:string; fields:string[]};
type Key = Pick<Trial,'clip'|'model'|'run'> & {audioId:string};

function writeNew(file:string,data:unknown) {
  writeFileSync(file,JSON.stringify(data,null,2),{flag:'wx',mode:0o600});
}
const [mode,manifest,observations,dir,destination]=process.argv.slice(2);
if (!['init','join'].includes(mode) || !manifest || !observations || !dir || (mode==='join'&&!destination)) {
  throw Error('Usage: tsx eval/reliability/listener-review.ts init|join clips.json trials.jsonl review-dir [NEW-reviewed-trials.jsonl]');
}
const clips:(Clip & {audio:string})[]=JSON.parse(readFileSync(manifest,'utf8'));
const trials:RecordingTrial[]=readFileSync(observations,'utf8').split(/\r?\n/).filter(s=>s.trim()).map(s=>JSON.parse(s));
const models=[...new Set(trials.map(t=>t.model))];
pairedAudio(clips,trials,models,'dev');
const packet=join(dir,'reviewer');
if (mode==='init') {
  mkdirSync(dir,{mode:0o700}); // refuse to overwrite or mix review rounds
  mkdirSync(packet,{mode:0o700});
  const keys:Key[]=[], rows:ReviewRow[]=[];
  for (const t of trials) {
    const c=clips.find(c=>c.id===t.clip)!;
    if (c.status!=='verified' || t.error!==undefined || !t.playback || t.run!==1) continue;
    const audioId=randomUUID();
    const file=audioId+'-output'+extname(t.playback);
    const clipSource=audioId+'-source'+extname(c.audio);
    copyFileSync(resolve(dirname(observations),t.playback),join(packet,file));
    copyFileSync(resolve(dirname(manifest),c.audio),join(packet,clipSource));
    keys.push({audioId,clip:t.clip,model:t.model,run:t.run});
    rows.push({audioId,clipSource,file,status:'pending',direction:c.direction,reviewer:'',fields:Object.keys(c.truth),facts:{},warned:[]});
  }
  for (let i=rows.length-1;i>0;i--) {
    const j=randomInt(i+1);
    [rows[i],rows[j]]=[rows[j],rows[i]];
  }
  writeNew(join(packet,'worksheet.json'),rows);
  writeNew(join(dir,'private-key.json'),keys);
} else {
  const keys:Key[]=JSON.parse(readFileSync(join(dir,'private-key.json'),'utf8'));
  const rows:ReviewRow[]=JSON.parse(readFileSync(join(packet,'worksheet.json'),'utf8'));
  const byId=new Map(rows.map(r=>[r.audioId,r]));
  if (rows.length!==byId.size || rows.length!==keys.length || !keys.every(k=>byId.has(k.audioId))) throw Error('Review items changed');
  const attached=new Set<RecordingTrial>();
  for (const k of keys) {
    const r=byId.get(k.audioId)!;
    if (r.status==='pending') continue;
    if (r.status!=='verified' || !r.reviewer?.trim()) throw Error('Review status or reviewer missing');
    const t=trials.find(t=>t.clip===k.clip && t.model===k.model && t.run===k.run);
    if (!t || attached.has(t)) throw Error('Review does not match original trial');
    attached.add(t);
    t.listener={audioId:k.audioId,reviewer:r.reviewer,direction:r.direction,facts:r.facts,warned:r.warned,firstAudioDelayMs:r.firstAudioDelayMs};
  }
  pairedAudio(clips,trials,models,'dev');
  writeFileSync(destination,trials.map(t=>JSON.stringify(t)).join('\n')+'\n',{flag:'wx',mode:0o600});
}
