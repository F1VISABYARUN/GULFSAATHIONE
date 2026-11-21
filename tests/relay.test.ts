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
