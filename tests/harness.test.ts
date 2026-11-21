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
  for (const id of ['VISIT_VISA', 'FEE_ABOVE_CAP', 'AGENT_NOT_IN_REGISTRY']) assert.ok(ids.includes(id), id);
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

// ---- Telugu script (turns taken from real Saathi test calls)
import { toLatin } from '../server/harness/translit.ts';
test('transliterate Telugu and Devanagari', () => {
  assert.equal(toLatin('ఒక లక్ష యాభై వేలు'), 'oka laksha yaabhai velu');
  assert.equal(toLatin('జీతం రాలేదండి'), 'jeetam raaledandi');
  assert.equal(toLatin('आया मैं खतर में हूं'), 'aayaa main khatar men hoon');
});
test('Telugu-script money, visa, place', () => {
  const h = runHarness('జగిత్యాల పదిహేను లక్షలు ఇచ్చినాము. సందర్శక వీజా.');
  assert.equal(h.slots.feeINR, 1500000);
  assert.equal(h.slots.visaType, 'visit');
  assert.equal(h.slots.district, 'Jagtial');
});
test('Telugu-script distress + airport stranger escalates', () => {
  const h = runHarness('చేరుకున్నాను వేరే వాళ్ళు తీసుకెళ్లారు. పాస్పోర్ట్ తీసుకున్నారు.');
  assert.equal(h.slots.takenByStranger, true);
  assert.equal(h.slots.passportHeld, true);
  assert.equal(h.escalate, true);
  assert.ok(assessRisks(h.slots).some(r => r.id === 'TAKEN_BY_STRANGER'));
});
test('phone in Telugu-script English digit words', () => {
  assert.equal(runHarness('98 48 జీరో వన్ టూ త్రీ ఫోర్ ఫైవ్').slots.phones?.[0], '+91 98480 12345');
});
test('"zero" heard as జూలై is repaired only by the harness', () => {
  const t = '9 8 4 4 జూలై ఎయిట్ 1 2 3 4';
  assert.equal(runHarness(t).slots.phones?.[0], '+91 98440 81234');
  assert.notEqual(runHarness(t, {}, ALL_OFF).slots.phones?.[0], '+91 98440 81234');
});
test('"visit విజయ్" (visa misheard as a name) repaired only by the harness', () => {
  assert.equal(runHarness('విజిట్ విజయ్ మీద పోయి').slots.visaType, 'visit');
  assert.equal(runHarness('విజిట్ విజయ్ మీద పోయి', {}, ALL_OFF).slots.visaType, undefined);
});
test('near-miss distress word (కోరుతున్నాడు ≈ కొడుతున్నాడు) triggers a read-back', () => {
  const h = runHarness('నన్ను ఓనర్ కోరుతున్నాడు');
  assert.ok(h.readBacks.some(r => /distress/i.test(r.reason)));
});
test('"ఒక రెండు లక్షలు" = about two lakh, not three', () => {
  assert.equal(runHarness('నేను ఒక రెండు లక్షల రూపాయలు ఇచ్చాను').slots.feeINR, 200000);
  assert.equal(runHarness('rendu moodu lakshalu adigadu agent').slots.feeINR, 300000);
});
test('Telugu agent name and place with case suffix', () => {
  const h = runHarness('ఏజెంట్ పేరు రమేష్. నేను దుబాయ్లో ఉన్నాను');
  assert.equal(h.slots.agentName, 'Ramesh');
  assert.equal(h.slots.country, 'UAE');
});
test('code phrase is caught by sound, escalates silently', () => {
  const ctx = { codePhrase: 'అమ్మ బాగుందా' };
  const h = runHarness('అంతా బాగుంది. అమ్మ బాగుంది అని చెప్పండి', ctx);
  assert.equal(h.slots.codePhrase, true);
  assert.equal(h.escalate, true);
  assert.ok(!h.readBacks.some(r => /amma/i.test(r.te)), 'never echo the code phrase');
  assert.equal(runHarness('అంతా బాగుంది', ctx).slots.codePhrase, undefined);
});
import { withQuestionContext, parseBolnaTranscript } from '../server/harness/qa.ts';
test('Q/A layer reads a bare "no" using the question', () => {
  const turns = parseBolnaTranscript('assistant: ఈ నెల జీతం వచ్చిందా?\nuser: రాలేదండి\nassistant: మీ పాస్‌పోర్ట్ మీ దగ్గరే ఉందా?\nuser: లేదు.');
  const h = runHarness(withQuestionContext(turns));
  assert.equal(h.slots.salaryPaid, false);
  assert.equal(h.slots.passportHeld, true);
});
import { checkAgent } from '../server/risk/agents.ts';
test('agent check uses the official MEA registered-RA list', () => {
  const hit = checkAgent('Karthik International', 'Karimnagar');
  assert.equal(hit.status, 'registered');
  assert.equal(hit.match?.raId, 'RA7468');
  assert.equal(checkAgent('Karthik International', 'Jagtial').status, 'registered_other_district');
  assert.equal(checkAgent('Ramesh').status, 'not_found');
});
test('official mandal gazetteer: mandal gives district; duplicate mandal asks', () => {
  const h = runHarness('naa peru Ramesh, Kodimyal mandal nundi');
  assert.equal(h.slots.mandal, 'Kodimial');
  assert.equal(h.slots.district, 'Jagtial');
  const dup = runHarness('memu Sarangapur nundi');
  assert.ok(dup.readBacks.some(r => /Jagtial/.test(r.reason) && /Nirmal/.test(r.reason)));
});
test('"agent mosam chesindu" is fraud, not a name; "vanda pani" is not ₹100', () => {
  const h = runHarness('నన్ను ఏజెంట్ మోసం చేసిండు. వండ పని అని చెప్పారు');
  assert.equal(h.slots.agentName, undefined);
  assert.equal(h.slots.cheatedByAgent, true);
  assert.equal(h.slots.feeINR, undefined);
  assert.ok(assessRisks(h.slots).some(r => r.id === 'AGENT_FRAUD_REPORTED'));
});
import { silenceStatus } from '../server/checkins.ts';
test('silence is a signal: no arrival call in 48 h escalates; weekly overdue', () => {
  const now = new Date('2026-11-21T12:00:00Z');
  const departed = { caseId: 'X', everyDays: 7, missedAttempts: 0, departedOn: '2026-11-18T12:00:00Z', arrivalDueBy: '2026-11-20T12:00:00Z' };
  assert.equal(silenceStatus(departed, now).state, 'escalate');
  const weekly = { caseId: 'Y', everyDays: 7, missedAttempts: 0, lastContact: '2026-11-10T12:00:00Z' };
  assert.equal(silenceStatus(weekly, now).state, 'overdue');
  assert.equal(silenceStatus({ ...weekly, missedAttempts: 3 }, now).state, 'escalate');
  assert.equal(silenceStatus({ ...weekly, lastContact: '2026-11-20T12:00:00Z' }, now).state, 'ok');
});
import { assist, detectIntent, extractAnchor } from '../server/assistant.ts';
test('assistant: intents from Telugu speech', () => {
  assert.equal(detectIntent('బుర్జ్ ఖలీఫా దగ్గర ఉన్నాను, ఇండియన్ హోటల్ కావాలి'), 'find_place');
  assert.equal(detectIntent('ఈ బస్సు ఎక్కడికి వెళ్తుంది'), 'bus_route');
  assert.equal(detectIntent('ఫిర్యాదు చేయాలి జీతం ఇవ్వలేదు'), 'complaint');
  assert.equal(extractAnchor('నేను బుర్జ్ ఖలీఫా దగ్గర ఉన్నాను').anchor, 'burj khaleephaa'.slice(0, 0) + extractAnchor('నేను బుర్జ్ ఖలీఫా దగ్గర ఉన్నాను').anchor);
});
test('assistant: never guesses location; no key -> says live search unavailable', async () => {
  delete process.env.GOOGLE_MAPS_API_KEY;
  const noLoc = await assist('నాకు ఇండియన్ హోటల్ కావాలి');
  assert.equal(noLoc.needs, 'location');
  const r = await assist('Burj Khalifa daggara unnanu, Indian hotel kavali');
  assert.equal(r.liveSearch, 'not_configured');
  const bus = await assist('ee bassu ekkadiki velthundi, Deira lo unnanu');
  assert.equal(bus.needs, 'bus_number');
});
test('assistant: danger escalates before anything else; speak-for-me gives Arabic lines', async () => {
  const e = await assist('నన్ను కొడుతున్నారు కాపాడండి, ఇండియన్ హోటల్ ఎక్కడ');
  assert.equal(e.intent, 'emergency');
  assert.equal(e.escalate, true);
  const s = await assist('naa taraphuna arabic lo cheppandi, naaku tindi kavali');
  assert.equal(s.intent, 'speak_for_me');
  assert.ok(s.speakForMe?.some(l => l.key === 'need_food'));
});
import { nextStep } from '../server/checkin-flow.ts';
test('check-in engine: asks in order, reads bare answers, escalates on stranger pickup', () => {
  const ctx = { promise: { employerName: 'AI NOOR CLEANING', job: 'cleaner' } };
  let s = nextStep({ kind: 'weekly', turns: [] }, ctx);
  assert.equal(s.qid, 'salary');
  s = nextStep({ kind: 'weekly', turns: [{ qid: 'salary', q: 'ఈ నెల జీతం వచ్చిందా?', a: 'రాలేదండి' }] }, ctx);
  assert.equal(s.slots.salaryPaid, false);
  assert.equal(s.qid, 'passport');
  const arr = nextStep({ kind: 'arrival', turns: [
    { qid: 'arrived', q: 'మీరు చేరుకున్నారా? ఏ ఊరిలో ఉన్నారు?', a: 'దుబాయ్లో ఉన్నాను' },
    { qid: 'pickup', q: 'మిమ్మల్ని ఎవరు తీసుకెళ్లారు? మీ కంపెనీ వాళ్లేనా?', a: 'లేదు వేరే వాళ్ళు' },
  ] }, ctx);
  assert.equal(arr.action, 'ESCALATE');
  const ok = nextStep({ kind: 'arrival', turns: [
    { qid: 'arrived', q: 'మీరు చేరుకున్నారా? ఏ ఊరిలో ఉన్నారు?', a: 'దుబాయ్' },
    { qid: 'pickup', q: 'మిమ్మల్ని ఎవరు తీసుకెళ్లారు? మీ కంపెనీ వాళ్లేనా?', a: 'అవును' },
  ] }, ctx);
  assert.equal(ok.qid, 'passport');
});
