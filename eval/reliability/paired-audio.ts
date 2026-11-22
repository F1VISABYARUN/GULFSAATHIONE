import { isDeepStrictEqual } from 'node:util';
import { extractTurn } from './extract.ts';

interface Truth {state:'reported'|'unclear'|'absent'; value?:unknown}
export interface Clip {
  id:string; call:string; speaker:string; split:'dev'|'heldout'; status:'pending'|'verified'|'skip';
  dataset:string; direction:string; question?:string; truth:Record<string,Truth>;
}
export interface Trial {
  clip:string; model:string; run:number; error?:string; text?:string; ms?:number;
  // Listeners mark only what they heard in a blind review of final output audio.
  listener?:{ reviewer:string; direction:string; audioId:string; facts:Record<string,unknown>; warned:string[]; firstAudioDelayMs?:number };
}
function frac(count:number,total:number) {return {count,total,rate:total ? count/total : null};}
function latency(values:number[]) {
  const sorted=[...values].sort((a,b)=>a-b);
  const at=(p:number)=>sorted.length ? sorted[Math.ceil(sorted.length*p)-1] : null;
  return {n:sorted.length,p50:at(.5),p95:at(.95)};
}
function finiteMs(n:unknown) {return typeof n==='number' && Number.isFinite(n) && n>=0;}
function validate(clips:Clip[], trials:Trial[], models:string[]) {
  if (!models.length || new Set(models).size!==models.length || models.some(m=>!m.trim())) throw Error('Supply distinct comparison models');
  const ids=new Map<string,Clip>();
  const partitions=new Map<string,string>();
  for (const c of clips) {
    if (!c.id || ids.has(c.id) || !c.call || !c.dataset?.trim() || !['dev','heldout'].includes(c.split) ||
        !['verified','pending','skip'].includes(c.status) || !/^[a-z]{2}-[a-z]{2}$/.test(c.direction)) throw Error('Invalid or duplicate clip');
    ids.set(c.id,c);
    if (c.status==='verified' && (!c.speaker?.trim() || !c.truth || !Object.keys(c.truth).length)) throw Error('Verified clip needs speaker and truth');
    for (const [field,t] of Object.entries(c.truth??{})) {
      if (!field || !['reported','unclear','absent'].includes(t.state) || (t.state==='reported')!==(t.value!=null)) throw Error('Invalid truth field');
    }
    for (const key of ['call/'+c.call,...(c.speaker ? ['speaker/'+c.speaker] : [])]) {
      if (partitions.has(key) && partitions.get(key)!==c.split) throw Error('Split leakage: '+key);
      partitions.set(key,c.split);
    }
  }
  const keys=new Set<string>();
  for (const t of trials) {
    const c=ids.get(t.clip), key=JSON.stringify([t.clip,t.model,t.run]);
    if (!c || !t.model || !Number.isInteger(t.run) || t.run<1 || keys.has(key)) throw Error('Invalid or duplicate trial');
    keys.add(key);
    if ((typeof t.text==='string') === (typeof t.error==='string') || (t.ms!==undefined && !finiteMs(t.ms))) throw Error('Trial needs a transcript or error and valid timing');
    const l=t.listener;
    if (l && (t.error!==undefined || !l.audioId?.trim() || !l.reviewer?.trim() || l.direction!==c.direction ||
        !l.facts || typeof l.facts!=='object' || Array.isArray(l.facts) || !Array.isArray(l.warned) ||
        l.warned.some(field=>!Object.hasOwn(c.truth,field)) || (l.firstAudioDelayMs!==undefined && !finiteMs(l.firstAudioDelayMs)))) throw Error('Invalid final-audio review');
  }
}

function compareFacts(clip:Clip, facts:Record<string,unknown>, warned:string[]=[]) {
  let known=0, right=0, invented=0, silent=0;
  for (const [field,label] of Object.entries(clip.truth)) {
    if (label.state==='reported') {
      known++;
      if (isDeepStrictEqual(facts[field],label.value)) right++;
      else if (!warned.includes(field)) silent++;
    } else if (facts[field]!=null) invented++;
  }
  return {known,right,invented,silent};
}

export function pairedAudio(clips:Clip[], trials:Trial[], models:string[], split:'dev'|'heldout') {
  validate(clips,trials,models);
  const index=new Map(trials.map(t=>[JSON.stringify([t.clip,t.model,t.run]),t]));
  const primary=(c:Clip,m:string)=>index.get(JSON.stringify([c.id,m,1]));
  const verified=clips.filter(c=>c.split===split && c.status==='verified');
  const strata=new Map(verified.map(c=>[JSON.stringify([c.dataset,c.direction]),[c.dataset,c.direction]]));
  return {split,verified:verified.length,groups:[...strata.values()].map(([dataset,direction])=>{
    const eligible=verified.filter(c=>c.dataset===dataset && c.direction===direction);
    const paired=eligible.filter(c=>models.every(m=>typeof primary(c,m)?.text==='string'));
    const reviewed=paired.filter(c=>models.every(m=>primary(c,m)?.listener));
    const systems=models.map(model=>{
      const results=eligible.map(c=>primary(c,model));
      const metrics=(enhanced:boolean)=>{
        let known=0,right=0,invented=0;
        for (const c of paired) {
          const slots=extractTurn({text:primary(c,model)!.text!,q:c.question},enhanced).slots;
          const score=compareFacts(c,{...slots});
          known+=score.known;right+=score.right;invented+=score.invented;
        }
        return {criticalFacts:frac(right,known),unsupportedOnLabeledFields:invented};
      };
      let heard=0,silent=0,reported=0,invented=0;
      const delays:number[]=[];
      for (const c of reviewed) {
        const l=primary(c,model)!.listener!;
        const score=compareFacts(c,l.facts,l.warned);
        reported+=score.known;heard+=score.right;silent+=score.silent;invented+=score.invented;
        if (l.firstAudioDelayMs!==undefined) delays.push(l.firstAudioDelayMs);
      }
      let repeated=0, changed=0, repeatErrors=0;
      for (const c of eligible) {
        const all=trials.filter(t=>t.clip===c.id && t.model===model && t.run>1);
        repeatErrors+=all.filter(t=>t.error!==undefined).length;
        const first=primary(c,model);
        const successful=all.filter(t=>t.text!==undefined);
        if (first?.text===undefined || !successful.length) continue;
        repeated++;
        if (successful.some(t=>t.text!==first.text)) changed++;
      }
      return {model,missing:results.filter(t=>!t).length,failed:results.filter(t=>t?.error!==undefined).length,
        base:metrics(false),saathi:metrics(true),providerMs:latency(paired.flatMap(c=>primary(c,model)!.ms??[])),
        repeatTranscriptChanged:frac(changed,repeated),repeatErrors,
        reviewedPlayback:{criticalFacts:frac(heard,reported),silentMiss:frac(silent,reported),unsupportedOnLabeledFields:invented,
          endOfSpeechToFirstAudioMs:latency(delays)}};
    });
    return {dataset,direction,eligibleClips:eligible.length,pairedClips:paired.length,pairedSpeakers:new Set(paired.map(c=>c.speaker)).size,
      pairedCalls:new Set(paired.map(c=>c.call)).size,pairedPlaybackReviews:reviewed.length,systems};
  })};
}
