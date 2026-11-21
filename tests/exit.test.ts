import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { readFileSync } from 'node:fs';
import { planExit, parseExpiry, readBackDate, daysBetween, countryOf, visaOf } from '../server/exit/engine.ts';
import { registerSaathi } from '../server/saathi.ts';

const today = new Date(Date.UTC(2026, 10, 22));
const rules = JSON.parse(readFileSync(new URL('../server/data/exit_rules.json', import.meta.url), 'utf8'));
const full = { country: 'UAE', visaType: 'visit', expiry: '5 days', passportHeld: 'yes', problem: 'none', intent: 'home', today };

test('dates: relative, written and numeric forms, and bad input is not guessed', () => {
  const d = (t: string) => parseExpiry(t, today)?.toISOString().slice(0, 10);
  assert.equal(d('5 days'), '2026-11-27'); assert.equal(d('ఐదు రోజులు'), '2026-11-27'); assert.equal(d('27 November 2026'), '2026-11-27');
  assert.equal(d('27/11/2026'), '2026-11-27'); assert.equal(d('2026-12-04'), '2026-12-04'); assert.equal(d('డిసెంబర్ 3'), '2026-12-03');
  assert.equal(d('31/02/2026'), undefined); assert.equal(d('abc'), undefined); assert.equal(d(''), undefined);
});
test('the date is read back digit by digit, day then month then year', () => {
  assert.equal(readBackDate(new Date(Date.UTC(2026, 10, 27))), '2 7, 1 1, 2 0 2 6');
  assert.equal(daysBetween(today, new Date(Date.UTC(2026, 10, 27))), 5);
});
test('country and visa type are read from spoken Telugu and English', () => {
  assert.equal(countryOf('నేను దుబాయ్ లో ఉన్నాను'), 'UAE'); assert.equal(countryOf('సౌదీ లో'), 'Saudi Arabia'); assert.equal(countryOf('ఇక్కడ'), undefined);
  assert.equal(visaOf('టూరిస్ట్ వీసా'), 'visit'); assert.equal(visaOf('వర్క్ వీసా'), 'work'); assert.equal(visaOf('hello'), 'unknown');
});
test('questions come in order: country, visa, expiry, passport, problem, intent', () => {
  const order = [{}, { country: 'UAE' }, { country: 'UAE', visaType: 'visit' }, { country: 'UAE', visaType: 'visit', expiry: '5 days' }, { country: 'UAE', visaType: 'visit', expiry: '5 days', passportHeld: 'yes' }, { country: 'UAE', visaType: 'visit', expiry: '5 days', passportHeld: 'yes', problem: 'none' }];
  assert.deepEqual(order.map(o => planExit({ ...o, today }).ask?.slot), ['country', 'visa_type', 'expiry', 'passport', 'problem', 'intent']);
});
test('an unreadable date asks again instead of guessing', () => {
  const p = planExit({ country: 'UAE', visaType: 'visit', expiry: 'soon', today });
  assert.equal(p.ask?.slot, 'expiry'); assert.ok(p.flags.includes('expiry_not_understood'));
});
test('the date is read back before the next question', () => {
  assert.match(planExit({ country: 'UAE', visaType: 'visit', expiry: '27/11/2026', today }).sayTe, /2 7, 1 1, 2 0 2 6/);
});
test('UAE visit visa ending in 5 days: sourced fine and extension fees, no promises, no grace period', () => {
  const p = planExit(full);
  assert.equal(p.status, 'plan'); assert.equal(p.daysLeft, 5); assert.equal(p.urgency, 'high');
  assert.match(p.sayTe, /5 రోజులు/); assert.match(p.sayTe, /50 దిర్హమ్స్/); assert.match(p.sayTe, /800 46342/);
  assert.ok(p.steps.filter(s => s.fact).every(s => s.status === 'confirmed' && s.source));
  assert.doesNotMatch(JSON.stringify(p.steps), /grace|amnesty/i);
  assert.ok(p.never.includes('promise a return date or that the embassy will pay'));
});
test('UAE overstay: fine is computed from the confirmed daily rate; departure permit and ticket rule are stated', () => {
  const p = planExit({ ...full, expiry: '17 November 2026', passportHeld: 'no' });
  assert.equal(p.daysLeft, -5); assert.ok(p.flags.includes('overstayed')); assert.ok(p.flags.includes('passport_not_with_worker'));
  const t = p.steps.map(s => s.te).join(' ');
  assert.match(t, /250 దిర్హమ్స్/); assert.match(t, /200 దిర్హమ్స్/); assert.match(t, /60 దిర్హమ్స్/); assert.match(t, /7 రోజుల్లో/);
});
test('Saudi: says up to 50,000 but never a total, and calls 19911 nothing', () => {
  const p = planExit({ ...full, country: 'Saudi Arabia' });
  const t = p.steps.map(s => s.te).join(' ');
  assert.match(t, /50,000 రియాల్స్ వరకు/); assert.match(t, /ఖచ్చితమైన మొత్తం నేను చెప్పలేను/); assert.doesNotMatch(t, /19911/);
  assert.equal(p.steps[0].status, 'official_headline');
});
test('a country without confirmed rules gets no invented figures', () => {
  const p = planExit({ ...full, country: 'Kuwait' });
  const t = p.steps.map(s => s.te).join(' ');
  assert.match(t, /అంకెలు చెప్పను/); assert.ok(p.steps.every(s => !s.fact));
  assert.doesNotMatch(t.replace(/ఇంకా \d+ రోజులు/, ''), /\b(AED|SAR|దిర్హమ్స్|రియాల్స్)\b/);
});
test('danger skips every question and gives the embassy line', () => {
  const p = planExit({ danger: true, country: 'UAE', today });
  assert.equal(p.status, 'escalate'); assert.equal(p.urgency, 'critical'); assert.match(p.sayTe, /800 46342/);
});
test('every fact in the data file has a source and a status; unverified facts are listed, not spoken', () => {
  const walk = (o: any, path: string): void => { if (o && typeof o === 'object') { if ('status' in o) { assert.match(o.status, /^(confirmed|official_headline|official_snippet|unverified)$/, path); assert.ok(o.source, path + ' needs a source'); } for (const [k, v] of Object.entries(o)) walk(v, path + '.' + k); } };
  walk(rules.countries, 'countries');
  assert.ok(rules.not_verified.length >= 5);
});

test('exit-path tool route: needs the secret, asks the first question, and returns a sourced plan', async t => {
  process.env.STORE = 'memory'; process.env.SAATHI_SECRET = 'fixture';
  const app = express(); app.use(express.json());
  registerSaathi(app, (req, res, next) => req.get('x-saathi-secret') === 'fixture' ? next() : void res.sendStatus(401));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); t.after(() => { server.close(); });
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/tools/exit-path`;
  const post = (body: object, key = 'fixture') => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-saathi-secret': key }, body: JSON.stringify(body) });
  assert.equal((await post({}, 'bad')).status, 401);
  const first = await (await post({ caller_said: 'నా వీసా అయిపోతోంది' })).json() as any;
  assert.equal(first.status, 'ask'); assert.equal(first.ask.slot, 'country');
  const plan = await (await post({ country: 'UAE', visa_type: 'tourist', expiry: '5 days', passport_with_worker: 'no', problem: 'none', intent: 'home', caller_phone: '+910000000009' })).json() as any;
  assert.equal(plan.status, 'plan'); assert.ok(plan.case_id); assert.match(plan.instruction, /60 దిర్హమ్స్/);
  const danger = await (await post({ caller_said: 'నన్ను కొడుతున్నారు, కాపాడండి', country: 'UAE' })).json() as any;
  assert.equal(danger.status, 'escalate');
});
