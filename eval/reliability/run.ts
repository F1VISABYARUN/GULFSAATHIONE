// Paired evaluation. Reference labels never enter the transcript extractor.
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { runHarness, ALL_ON } from '../../server/harness/index.ts';
import { prepare, readCatalog } from './review.ts';
import { assessRisks } from '../../server/risk/engine.ts';
import { wer } from '../scorer.ts';
import { normalizeText } from '../../server/harness/tokens.ts';
import { extractTurn } from './extract.ts';

type Label = {state:'reported'|'unclear'|'absent';value?:unknown};
type Fact = {state:'value'|'unknown';value?:unknown;p?:number};
interface Output { transcript?:string; risks?:string[]; facts:Record<string,Fact>; asked:string[][]; extraSeconds?:number }
interface Turn {
  call:string; turn:number; speaker:string; split:'dev'|'heldout';
  status:'pending'|'verified'|'skip'; referenceText?:string; risks?:string[];
  truth:Record<string,Label>; base?:Output; saathi?:Output;
}
const [path, arg2, arg3, catalogPath] = process.argv.slice(2);
if (path==='init') {
  if (!arg2) throw Error('Usage: benchmark init PRIVATE-WORKSHEET.json [catalog.json]');
  prepare(arg2,arg3);
  process.exit(0);
}
const mode=arg2??'text', split=arg3??'dev';
if (!path || !['trace','text'].includes(mode) || !['dev','heldout'].includes(split)) throw Error('Usage: benchmark FILE.json [trace|text] [heldout|dev] [catalog.json]');
const rows:Turn[] = JSON.parse(readFileSync(path,'utf8'));
const catalog = new Map(readCatalog(catalogPath).map(call=>[call.id8,call]));
const partitions = new Map<string,string>();
const ids = new Set<string>();
for (const row of rows) {
  if (!['pending','verified','skip'].includes(row.status)) throw Error('Set each review status explicitly');
  if ((row.status==='verified' && !row.speaker?.trim()) || !row.call || !Number.isInteger(row.turn) || row.turn<1 || !['heldout','dev'].includes(row.split)) throw Error('Missing call, turn, split or speaker');
  const id = JSON.stringify([row.call,row.turn]);
  if (ids.has(id)) throw Error('Duplicate turn: '+id);
  ids.add(id);
  for (const key of ['call:'+row.call,...(row.speaker?['speaker:'+row.speaker]:[])]) {
    if (partitions.has(key) && partitions.get(key)!==row.split) throw Error('Split leakage: '+key);
    partitions.set(key,row.split);
  }
}
const partition = rows.filter(r=>r.split===split);
const selected = partition.filter(r=>r.status==='verified');
const coverage = {totalTurns:partition.length, verifiedTurns:selected.length, skippedTurns:partition.filter(r=>r.status==='skip').length};
if (!selected.length) {
  console.log(JSON.stringify({mode,split,coverage,status:'awaiting_verified_labels',base:null,saathi:null},null,2));
  process.exit(0);
}

function extract(row:Turn, saathi:boolean):Output {
  const turn=catalog.get(row.call)?.turns[row.turn-1];
  if (!turn) throw Error('Missing transcript in catalog: '+row.call+' turn '+row.turn);
  const {slots} = extractTurn(turn, saathi);
  return {transcript:saathi?runHarness(turn.text,{},ALL_ON).corrected:turn.text,
    risks:assessRisks(slots).filter(r=>!r.id.startsWith('AGENT_')).map(r=>r.id),
    facts:Object.fromEntries(Object.entries(slots).map(([key,value])=>[key,{state:'value',value}])),asked:[]};
}
function fraction(count:number,total:number) {return {count,total,rate:total ? count/total : null};}
function report(variant:'base'|'saathi') {
  let reported=0, silent=0, unsupported=0, unknown=0, unknownCorrect=0, unknowable=0, questions=0, seconds=0, timed=0;
  const bins = ['<0.6','0.6–<0.9','0.9–1'].map(range=>({range,n:0,sum:0,right:0}));
  let exact=0, riskTotal=0, riskCaught=0, falseAlarms=0, wordCount=0, edits=0, deferred=0;
  const byField = new Map<string,{reported:number;exact:number;unflagged:number}>();
  const misses = [];
  for (const row of selected) {
    const out = mode==='trace' ? row[variant] : extract(row,variant==='saathi');
    if (!out || !out.facts || !Array.isArray(out.asked) || !out.asked.every(q=>Array.isArray(q) && q.every(f=>typeof f==='string'))) throw Error('Missing or invalid variant trace: '+variant);
    if (row.risks!==undefined) {
      if (!Array.isArray(row.risks)||!Array.isArray(out.risks)) throw Error('Risk labels require both variant risk lists');
      const expected=new Set(row.risks), found=new Set(out.risks);
      riskTotal+=expected.size;
      riskCaught+=[...expected].filter(r=>found.has(r)).length;
      falseAlarms+=[...found].filter(r=>!expected.has(r)).length;
    }
    if (row.referenceText!==undefined) {
      const n=normalizeText(row.referenceText).split(' ').filter(Boolean).length;
      if (!n || typeof out.transcript!=='string') throw Error('WER needs a nonempty reference and both transcripts');
      wordCount+=n; edits+=Math.round(n*wer(row.referenceText,out.transcript));
    }
    questions+=out.asked.length;
    if (out.extraSeconds!==undefined) {
      if (!Number.isFinite(out.extraSeconds) || out.extraSeconds<0) throw Error('Invalid timing');
      seconds+=out.extraSeconds; timed++;
    }
    if (!Object.keys(row.truth).length) throw Error('Missing reference annotations');
    for (const [key,label] of Object.entries(row.truth)) {
      const fact=out.facts[key];
      const known=label.state==='reported';
      if (!['reported','absent','unclear'].includes(label.state) || known !== (label.value!=null)) throw Error('Invalid reference: '+key);
      if (fact && (!['value','unknown'].includes(fact.state) || (fact.state==='value') !== (fact.value!=null))) throw Error('Invalid prediction: '+key);
      const correct=known && fact?.state==='value' && isDeepStrictEqual(label.value,fact.value);
      const totals=byField.get(key)??{reported:0,exact:0,unflagged:0};
      byField.set(key,totals);
      if (known) totals.reported++;
      if (correct) {exact++; totals.exact++;}
      if (known && !correct && (fact?.state==='unknown' || out.asked.some(q=>q.includes(key)))) deferred++;
      if (known) reported++; else unknowable++;
      if (fact?.state==='unknown') {unknown++; if (!known) unknownCorrect++;}
      if (!known && fact?.state==='value') unsupported++;
      if (known && !correct && fact?.state!=='unknown' && !out.asked.some(q=>q.includes(key))) {
        silent++; totals.unflagged++; misses.push({call:row.call,turn:row.turn,field:key});
      }
      if (fact?.p!==undefined) {
        const p=fact.p;
        if (!Number.isFinite(p) || p<0 || p>1 || fact.state!=='value') throw Error('Invalid probability');
        const bin=bins[p<0.6?0:p<0.9?1:2]; bin.n++; bin.sum+=p; bin.right+=Number(correct);
      }
    }
  }
  const calls=new Set(selected.map(r=>r.call)).size;
  return {calls, turns:selected.length, criticalFactAccuracy:fraction(exact,reported), flaggedUnresolved:mode==='trace'?fraction(deferred,reported):null,
    riskRecall:fraction(riskCaught,riskTotal),falseAlarmsOnRiskLabeledTurns:falseAlarms,normalizedWER:fraction(edits,wordCount), silentMiss:mode==='trace'?fraction(silent,reported):null,byField:Object.fromEntries([...byField].map(([field,t])=>[field,{accuracy:fraction(t.exact,t.reported),silentMiss:mode==='trace'?fraction(t.unflagged,t.reported):null}])),misses,unsupported,
    unknownPrecision:mode==='trace'?fraction(unknownCorrect,unknown):null,unknownRecall:mode==='trace'?fraction(unknownCorrect,unknowable):null,
    questionsPerCall:mode==='trace'?questions/calls:null, extraSecondsPerCall:timed===selected.length?seconds/calls:null,
    calibration:bins.map(b=>({range:b.range,count:b.n,meanConfidence:b.n?b.sum/b.n:null,accuracy:b.n?b.right/b.n:null}))};
}
console.log(JSON.stringify({split,mode,coverage,base:report('base'),saathi:report('saathi')},null,2));
