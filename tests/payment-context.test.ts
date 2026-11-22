import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { nextStep } from '../server/checkin-flow.ts';
import { gateDecision } from '../server/live.ts';
import { salaryReceipt, CONFIRM_SALARY } from '../server/harness/qa.ts';
import { registerSaathi } from '../server/saathi.ts';
import { store } from '../server/store.ts';

test('receipt requires one unambiguous salary question and a clear answer', () => {
  const q = 'ఈ నెల జీతం వచ్చిందా?';
  for (const text of ['లేదండి', "I didn't get it", 'రాలేదండి.']) assert.equal(salaryReceipt({ q, text }), false);
  assert.equal(salaryReceipt({ q, text: 'వచ్చిందండి' }), true);
  assert.equal(salaryReceipt({ q: 'Did you get the fee?', text: 'no' }), undefined);
  for (const turn of [
    {q, text: 'అదలక'}, {q, text: 'లేదు, బస్సు లేదు'}, {q: "Didn't you receive salary?", text: 'no'},
    {q:'మీ జీతం రాలేదా?', text: 'అవును'},
  ]) assert.equal(salaryReceipt(turn), 'unknown');
  const turn = {qid: 'salary', q, a: 'అదలక'};
  const weekly = nextStep({kind:'weekly', turns:[turn]});
  assert.equal(weekly.action, 'CONFIRM');
  assert.equal(weekly.qid, 'salary');
  assert.equal(nextStep({kind:'weekly', turns:[turn, {...turn,a:'అవును'}]}).qid, 'passport');
  const gate = gateDecision([{q,text:'అదలక'}], {});
  assert.equal(gate.action, 'CONFIRM');
  assert.equal(gate.sayTe, CONFIRM_SALARY);
  assert.equal(gate.slots.salaryPaid, undefined);
  assert.equal(gateDecision([{q,text:'they locked me in'}], {}).action, 'ESCALATE');
});

test('checkin, report and webhook retain ambiguous speech for follow-up and prioritize independent danger', async t => {
  process.env.STORE = 'memory';
  const app = express();
  app.use(express.json());
  registerSaathi(app, (_req, _res, next) => next());
  const server = app.listen(0,'127.0.0.1');
  await once(server,'listening');
  t.after(() => { server.close(); });
  const post = async (path:string, body:object) => (await fetch('http://127.0.0.1:' +
    (server.address() as AddressInfo).port + path, {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(body)})).json();
  const b = { caller_said:'అదలక', salary_question:CONFIRM_SALARY, salary_answer:'అదలక',
    salary_received:'no', notes:'salary not paid' };
  const initial = await post('/tools/record-checkin', b);
  assert.equal(initial.status, 'needs_confirm');
  assert.deepEqual((await store.calls(initial.case_id))[0].needsConfirmation, ['salary_received']);
  assert.ok(!initial.reasons.includes('SALARY_UNPAID'));
  const mismatch = await post('/tools/report-problem', {...b, case_id:initial.case_id, salary_answer:'లేదు'});
  assert.equal(mismatch.status, 'needs_confirm');
  const danger = await post('/tools/record-checkin', {...b, case_id:initial.case_id, threatened:'yes'});
  assert.equal(danger.level, 'critical');
  assert.notEqual(danger.instruction, CONFIRM_SALARY);
  const confirmed = await post('/tools/record-checkin', {...b, case_id:initial.case_id, caller_said:'రాలేదు.', salary_answer:'రాలేదు'});
  assert.ok(confirmed.reasons.includes('SALARY_UNPAID'));
  const payload = {status:'completed', context_details:{recipient_data:{case_id:initial.case_id}},
    transcript: 'assistant: ' + CONFIRM_SALARY + '\nuser: అదలక'};
  const webhook = await post('/webhooks/saathi',payload);
  assert.deepEqual(webhook.needs_confirmation,['salary_received']);
  assert.ok(!webhook.reasons.includes('SALARY_UNPAID'));
  const fee = await post('/tools/check-fee',{payments:'500000',caller_said:'అదలక'});
  assert.equal(fee.status,'needs_confirm');
  assert.equal(fee.total,null);
});
