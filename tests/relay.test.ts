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
    return Response.json({choices:[{message:{content:JSON.stringify({safety:'ordinary',confidence:'high',text:(to==='te'?'ఇక్కడ ':'هنا ')+(drop?'':locks.join(' '))})}}]});
  });
  const r=await relay('Dubai lo','te','ar');assert.equal(r.status,'translated');assert.match(r.back_translation,/Dubai/i);
  drop=true;assert.equal((await relay('Dubai lo','te','ar')).say_to_other,'');
});
