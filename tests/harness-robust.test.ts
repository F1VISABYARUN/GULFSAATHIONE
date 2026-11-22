// Regression tests for failures found in real runs (FLEURS read speech, IndicVoices, Bolna calls).
// The probe sentences are hand-written; they pin behaviour, they are not accuracy measurements.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runHarness, ALL_ON } from '../server/harness/index.ts';
import { tags } from '../eval/robustness/run.ts';
import { run as fuzz } from '../eval/robustness/fuzz.ts';
import { detectIntent } from '../server/assistant.ts';

const { cases } = JSON.parse(readFileSync(new URL('../eval/robustness/cases.json', import.meta.url), 'utf8')) as { cases: { id: string; text: string; must?: string[]; mustNot?: string[]; readback?: boolean }[] };

for (const c of cases) {
  test(`probe ${c.id}`, () => {
    const r = tags(c.text, true);
    for (const m of c.must ?? []) assert.ok(r.tags.includes(m), `${c.text}: expected ${m}, got [${r.tags}]`);
    for (const m of c.mustNot ?? []) assert.ok(!r.tags.includes(m), `${c.text}: invented ${m}`);
    if (c.readback !== undefined) assert.equal(r.readbacks > 0, c.readback, `${c.text}: readback`);
  });
}

test('a year is left as written in the corrected transcript', () => {
  assert.equal(runHarness('2010 లో నేను ఇండియా వచ్చాను', {}, ALL_ON).corrected, '2010 లో నేను ఇండియా వచ్చాను');
});
test('a named ID is not stored as a phone and the readback asks about the ID, not a phone', () => {
  const h = runHarness('my UAN number is 100234567890', {}, ALL_ON);
  assert.deepEqual(h.slots.idNumbers, [{ kind: 'UAN', digits: '100234567890' }]);
  assert.equal(h.slots.phones, undefined);
  assert.match(h.readBacks[0].te, /UAN number 1002 3456 7890/);
});
test('an 11-digit string asks the caller to repeat the number', () => {
  const h = runHarness('నా నంబర్ 98485210345', {}, ALL_ON);
  assert.ok(h.readBacks.some(b => /Phone number incomplete/.test(b.reason)));
});
test('property checks over generated sentences hold (seeded)', () => {
  for (const c of fuzz(300, 11)) assert.equal(c.bad.length, 0, `${c.name}: e.g. ${c.bad.slice(0, 2).join(' | ')}`);
});
test('Arabic place requests are recognised', () => {
  for (const t of ['أين المستشفى؟', 'أريد صيدلية', 'أين مركز الشرطة؟', 'أين السفارة الهندية؟']) assert.equal(detectIntent(t), 'find_place', t);
  assert.equal(detectIntent('مرحبا'), 'unknown');
});

import { tokenize } from '../server/harness/tokens.ts';
import { numberValues, segmentNumberRun } from '../server/harness/numbers.ts';
test('a list of numbers read aloud is split by place value, not merged', () => {
  assert.deepEqual(numberValues(tokenize('అరవై నాలుగు ఏడు వందల డెబ్బై ఐదు పదమూడు వందల తొంబై రెండు')), [64, 775, 1392]);
  assert.deepEqual(segmentNumberRun(['one', 'lakh', 'fifty', 'thousand']).length, 1);
});
test('digits with a glued Telugu suffix are numbers, and the corrected text keeps the original spacing', () => {
  const t = '6 అక్టోబర్ 1789న మార్కెట్‌లోని మహిళలు';
  assert.ok(numberValues(tokenize(t)).includes(1789));
  assert.equal(runHarness(t, {}, ALL_ON).corrected, t);
});

test('"paid zero" reads as salary not received, never as a fee or a paid salary', () => {
  for (const text of ['I got paid zero rupees', 'paid nothing for three months', 'నాకు జీతం సున్నా వచ్చింది', 'ఒక్క రూపాయి కూడా ఇవ్వలేదు', 'salary 0 rupees paid']) {
    const s = runHarness(text, {}, ALL_ON).slots;
    assert.equal(s.salaryPaid, false, text); assert.equal(s.feeINR, undefined, text);
  }
  assert.notEqual(runHarness('salary 25000 paid every month', {}, ALL_ON).slots.salaryPaid, false);
  assert.notEqual(runHarness('I paid the agent zero, there was no fee', {}, ALL_ON).slots.salaryPaid, false);
});
test('who took the passport is recorded and is never a junk name', () => {
  const a = runHarness('my passport the agent took it', {}, ALL_ON).slots;
  assert.equal(a.passportHeld, true); assert.equal(a.passportTakenBy, 'agent'); assert.equal(a.agentName, undefined);
  assert.equal(runHarness('my passport the sponsor took it', {}, ALL_ON).slots.passportTakenBy, 'employer');
  assert.equal(runHarness('నా పాస్‌పోర్ట్ కంపెనీ వాళ్ళు తీసుకున్నారు', {}, ALL_ON).slots.passportTakenBy, 'employer');
});
