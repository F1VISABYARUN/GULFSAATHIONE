import test from 'node:test';
import assert from 'node:assert/strict';
import {relay} from '../server/relay.ts';
test('relay withholds legal speech, offers a matching fixed phrase offline',async()=>{
  delete process.env.OPENAI_API_KEY;
  assert.equal((await relay('సంతకం చేస్తాను','te','ar')).status,'escalate_human');
  assert.ok('fixed_phrase' in await relay('నాకు తిండి కావాలి','te','ar'));
});
test('independent back translation; mismatch releases no employer speech',async t=>{
  process.env.OPENAI_API_KEY='fixture'; t.after(()=>{delete process.env.OPENAI_API_KEY;});
  let drop=false;
  t.mock.method(globalThis,'fetch',async(_url:unknown,init:RequestInit)=>{
    const data=JSON.parse(String(init.body));const {to,locks}=JSON.parse(data.messages[1].content);
    return Response.json({choices:[{message:{content:JSON.stringify({safety:'ordinary',confidence:'high',text:(String(to).startsWith('Telugu')?'ఇక్కడ ':'هنا ')+(drop?'':locks.join(' '))})}}]});
  });
  const r=await relay('Dubai lo','te','ar');assert.equal(r.status,'translated');assert.match(r.back_translation,/Dubai/i);
  drop=true;assert.equal((await relay('Dubai lo','te','ar')).say_to_other,'');
});
test('Telugu salary sentence translates: Arabic need not contain Telugu words, Telugu back-translation must',async t=>{
  process.env.OPENAI_API_KEY='fixture'; t.after(()=>{delete process.env.OPENAI_API_KEY;});
  const seen:string[]=[];
  t.mock.method(globalThis,'fetch',async(_url:unknown,init:RequestInit)=>{
    const {to}=JSON.parse(JSON.parse(String(init.body)).messages[1].content); seen.push(to);
    const text=String(to).startsWith('Telugu')?'నా జీతం ఇవ్వలేదు':'لم أستلم راتبي';
    return Response.json({choices:[{message:{content:JSON.stringify({safety:'ordinary',confidence:'high',text})}}]});
  });
  const r=await relay('నా జీతం ఇవ్వలేదు','te','ar');
  assert.equal(r.status,'translated'); assert.equal(r.say_to_other,'لم أستلم راتبي');
  assert.match(seen[0],/Arabic/); assert.match(seen[1],/Telugu/);
  const back=await relay('أين جواز سفرك؟','ar','te');
  assert.equal(back.status,'translated'); assert.match(seen.at(-1)!,/Telugu/);
});
test('passport spelling variants in the Telugu back-translation are accepted',async t=>{
  process.env.OPENAI_API_KEY='fixture'; t.after(()=>{delete process.env.OPENAI_API_KEY;});
  t.mock.method(globalThis,'fetch',async(_url:unknown,init:RequestInit)=>{
    const {to}=JSON.parse(JSON.parse(String(init.body)).messages[1].content);
    const text=String(to).startsWith('Telugu')?'నా పాస్‌పోర్టు తిరిగి ఇవ్వండి':'أعد لي جواز سفري';
    return Response.json({choices:[{message:{content:JSON.stringify({safety:'ordinary',confidence:'high',text,pronounce_te:'అఇద్ లీ'})}}]});
  });
  assert.equal((await relay('నా పాస్పోర్ట్ తిరిగి ఇవ్వండి','te','ar')).status,'translated');
});

test('withhold dropped, duplicated or reordered numeric facts before speaking either direction',async t=>{
  process.env.OPENAI_API_KEY='fixture'; t.after(()=>{delete process.env.OPENAI_API_KEY;});
  let output = '';
  t.mock.method(globalThis,'fetch',async()=>Response.json({choices:[{message:{
    content:JSON.stringify({text:output,safety:'ordinary',confidence:'high',pronounce_te:'డోలో'})
  }}]}));
  for(const [source,target] of [
    ['دولو ١٦٠','డోలో'], ['100 ثم 200','200 తర్వాత 100'], ['100','100 నుండి 100'],
    ['١٫٥','15'], ['50000','500000'],
  ]){
    output=target;
    const r=await relay(source,'ar','te');
    assert.equal(r.status,'needs_confirm');
    assert.equal(r.say_to_other,'');
  }
  output='డోలో 160';
  assert.equal((await relay('دولو ١٦٠','ar','te')).status,'translated');
});

test('meaningKept rejects a dropped negation or a changed Telugu amount',async()=>{
  const {meaningKept}=await import('../server/relay.ts');
  assert.equal(meaningKept('ఐదు లక్షలు ఇవ్వలేదు','వాళ్ళు ఐదు లక్షలు ఇచ్చారు'),false);
  assert.equal(meaningKept('ఐదు లక్షలు ఇవ్వలేదు','ఐదు లక్షలు ఇవ్వలేదు'),true);
  assert.equal(meaningKept('ఐదు లక్షలు ఇవ్వలేదు','యాభై వేలు ఇవ్వలేదు'),false);
});
