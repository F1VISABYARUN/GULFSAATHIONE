// Unit tests for the deterministic harness layers.
// Inputs here are hand-written test sentences, NOT benchmark results.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../server/harness/tokens.ts';
import { evaluateNumberRun, findMoney, findPhones, classifyPhone, formatMoney } from '../server/harness/numbers.ts';
import { runHarness, ALL_OFF } from '../server/harness/index.ts';
import { assessRisks } from '../server/risk/engine.ts';
import { similarity } from '../server/harness/phonetic.ts';

const money = (s: string) => findMoney(tokenize(s), new Set()).map(e => formatMoney(e.value as any));

test('Telugu money: oka laksha yaabhai velu = ₹1,50,000', () => {
  assert.deepEqual(money('agent ki oka laksha yaabhai velu ichanu'), ['₹1,50,000']);
});
test('Hindi money: dedh lakh, sava do lakh, saade teen hazaar', () => {
  assert.equal(evaluateNumberRun(['dedh', 'lakh'])!.value, 150000);
  assert.equal(evaluateNumberRun(['sava', 'do', 'lakh'])!.value, 225000);
  assert.equal(evaluateNumberRun(['saade', 'teen', 'hazaar'])!.value, 3500);
});
test('English money: one lakh twenty five thousand rupees', () => {
  assert.deepEqual(money('one lakh twenty five thousand rupees'), ['₹1,25,000']);
});
test('Gulf salary: 1200 dirhams / pannendu vandala riyals', () => {
  assert.deepEqual(money('salary 1200 dirhams'), ['AED 1,200']);
  assert.deepEqual(money('jeetham pannendu vandala riyals'), ['SAR 1,200']);
});
test('standalone small words are not money ("oka agent", "do you")', () => {
  assert.deepEqual(money('oka agent vachadu do you know'), []);
});
test('phone: Indian cadence with double/triple', () => {
  const p = findPhones(tokenize('number nine eight four eight double zero five two three one'));
  assert.equal(p.length, 1);
  assert.equal(p[0].text, '+91 98480 05231');
});
test('phone: Telugu digits', () => {
  const p = findPhones(tokenize('tommidi enimidi nalugu enimidi sunna sunna aidu rendu moodu okati'));
  assert.equal(p[0].text, '+91 98480 05231');
});
test('phone: 8 digits is flagged incomplete', () => {
  const v = classifyPhone('98485210');
  assert.equal(v.valid, false);
});
test('phonetic: Kodimyal / Cody meal ≈ Kodimial', () => {
  assert.ok(similarity('Kodimyal', 'Kodimial') > 0.85);
  assert.ok(similarity('Cody meal', 'Kodimial') > 0.8);
});
test('harness repairs place + Gulf term mishearing, base does not', () => {
  const t = 'nenu cody meal nundi, kafeel huroob pettadu';
  const h = runHarness(t);
  assert.match(h.corrected, /Kodimial/);
  assert.equal(h.slots.huroob, true);
  const asr = 'kafeel who rub pettadu';
  assert.equal(runHarness(asr).slots.huroob, true);
  assert.equal(runHarness(asr, {}, ALL_OFF).slots.huroob, undefined);
});
test('self-correction: only the final amount survives', () => {
  const h = runHarness('agent fee oka laksha kadu kadu oka laksha yaabhai velu teeskunnadu');
  assert.equal(h.slots.feeINR, 150000);
  assert.equal(h.revisions.length, 1);
  const base = runHarness('agent fee oka laksha kadu kadu oka laksha yaabhai velu teeskunnadu', {}, ALL_OFF);
  assert.equal(base.slots.feeINR, 150000); // last-wins happens to be right here
});
test('self-correction: work visa -> visit visa', () => {
  const h = runHarness('work visa ani chepparu, kadu, visit visa ichharu');
  assert.equal(h.slots.visaType, 'visit');
});
test('negation: jeetham ivvaledu = salary NOT paid', () => {
  assert.equal(runHarness('rendu nelalu jeetham ivvaledu').slots.salaryPaid, false);
  assert.equal(runHarness('jeetham ichhadu anna').slots.salaryPaid, true);
});
test('distress words escalate', () => {
  const h = runHarness('anna kodutunnaru kapadandi passport teeskunnaru');
  assert.equal(h.escalate, true);
  assert.equal(h.slots.passportHeld, true);
  assert.deepEqual(h.slots.distress?.sort(), ['help', 'violence']);
});
test('context names (L0) repair an unseen name', () => {
  const t = 'kafeel peru salim al harbi';
  const h = runHarness(t, { names: ['Saleem Al Harbi'] });
  assert.equal(h.slots.employerName, 'Saleem Al Harbi');
});
test('risk engine: visit visa + fee above cap + unlicensed agent', () => {
  const h = runHarness('agent Srinivas ki oka laksha yaabhai velu kattanu, visit visa ichadu');
  const ids = assessRisks(h.slots).map(r => r.id);
  for (const id of ['VISIT_VISA', 'FEE_ABOVE_CAP', 'AGENT_UNLICENSED']) assert.ok(ids.includes(id), id);
});
test('risk engine: check-in vs promise mismatch', () => {
  const promise = runHarness('driver job, salary 1500 dirhams, rojuki 8 gantalu').slots;
  const now = runHarness('ikkada mekalu kaayistunna, jeetham 800 dirhams, 16 gantalu').slots;
  const ids = assessRisks(now, promise).map(r => r.id);
  for (const id of ['SALARY_MISMATCH', 'JOB_MISMATCH', 'HOURS_MISMATCH']) assert.ok(ids.includes(id), id);
});
test('a word locked by another layer is never taken as a name ("kafeel who rub")', () => {
  assert.equal(runHarness('kafeel who rub pettadu').slots.employerName, undefined);
  assert.equal(runHarness('kafeel who rub pettadu', {}, ALL_OFF).slots.employerName, undefined);
});
