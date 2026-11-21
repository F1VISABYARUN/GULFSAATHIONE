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
