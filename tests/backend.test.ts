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
