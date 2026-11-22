import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createHmac } from 'node:crypto';
import { WebSocket } from 'ws';
process.env.STORE = 'memory';
const { store } = await import('../server/store.ts');
const { placeCall } = await import('../server/saathi.ts');
const { createInterpreter } = await import('../interpreter/server.ts');
const { AgentSession } = await import('../interpreter/agent.ts');
const { checkinServices } = await import('../interpreter/providers.ts');
import type { AgentServices, AgentStep } from '../interpreter/agent.ts';

const cfg = { origin: 'https://phone.example', backend: 'https://api.example', secret: 'fixture', authId: 'fixture', authToken: 'fixture',
  human: '+19999999999', openai: 'fixture', target: 'ar' };

test('scheduled Check-in calls are placed by our own server through Plivo, pointing at the call server', async t => {
  const d = { caseId: 'GS-PLV', phone: '+919000000001', kind: 'arrival' as const };
  await store.addWorker({ ...d, promise: { job: 'cleaner' }, consent: true });
  const env = { PLIVO_AUTH_ID: 'AUTHID', PLIVO_AUTH_TOKEN: 'tok', INTERPRETER_ORIGIN: 'https://phone.example', PLIVO_FROM_NUMBER: '+918065952403' };
  Object.assign(process.env, env);
  t.after(() => { for (const k of Object.keys(env)) delete process.env[k]; });
  const seen: { url: string; body: any; auth: string | null }[] = [];
  t.mock.method(globalThis, 'fetch', async (url: unknown, init: RequestInit) => {
    seen.push({ url: String(url), body: JSON.parse(String(init.body)), auth: new Headers(init.headers).get('authorization') });
    return Response.json({ request_uuid: 'uuid-1' });
  });
  const r: any = await placeCall(d);
  assert.equal(r.placed, true); assert.equal(r.via, 'plivo'); assert.equal(r.execution_id, 'uuid-1');
  assert.equal(seen[0].url, 'https://api.plivo.com/v1/Account/AUTHID/Call/');
  assert.equal(seen[0].body.from, '918065952403'); assert.equal(seen[0].body.to, '919000000001'); assert.equal(seen[0].body.answer_method, 'GET');
  const answer = new URL(seen[0].body.answer_url);
  assert.equal(answer.origin + answer.pathname, 'https://phone.example/answer');
  assert.deepEqual([answer.searchParams.get('mode'), answer.searchParams.get('case_id'), answer.searchParams.get('kind')], ['checkin', 'GS-PLV', 'arrival']);
  assert.match(seen[0].auth!, /^Basic /);
  const hangup = new URL(seen[0].body.hangup_url);
  assert.equal(hangup.pathname, '/webhooks/plivo-status'); assert.equal(hangup.searchParams.get('case_id'), 'GS-PLV'); assert.equal(seen[0].body.hangup_method, 'POST');
  assert.equal(((await placeCall({ ...d, phone: '000' })) as any).placed, false);       // bad number: nothing sent
  process.env.CHECKIN_VIA = 'bolna'; t.after(() => { delete process.env.CHECKIN_VIA; });
  const before = seen.length; await placeCall(d); assert.equal(seen.length, before);     // Bolna path needs its own settings: no Plivo call
});

function checkinFixture(steps: AgentStep[], said: string[], over: Partial<AgentServices> = {}) {
  const spoken: string[] = [], marks: string[] = [], stops: string[] = [];
  const service: AgentServices = { stt: async () => said.shift() ?? '', think: async () => steps.shift() ?? {}, check: async () => 'ok',
    speak: async (t, l) => { spoken.push(l + ' ' + t); return Buffer.from([255]); }, handoff: async () => { stops.push('handoff'); }, ...over };
  const session = new AgentSession('ar', service, { play: (_b, m) => marks.push(m), clear: () => {}, close: () => stops.push('close') }, 0, 'checkin', 'నమస్కారం రవి గారు, నేను సాథి నుండి మాట్లాడుతున్నాను.');
  const turn = async () => { await session.media(Buffer.alloc(4000, 0)); await session.media(Buffer.alloc(5000, 255)); session.played(marks.at(-1)!); };
  return { session, spoken, stops, marks, turn, begin: async () => { await session.start(); session.played(marks.at(-1)!); } };
}

test('Check-in call: Bolna welcome line, plain answers count, ends only after the answers were saved', async () => {
  const f = checkinFixture([{ say_to_worker: 'ఈ నెల జీతం వచ్చిందా?' }, { say_to_worker: 'సరే, నమోదు చేశాను. జాగ్రత్తగా ఉండండి.', done: true, recorded: true }], ['హలో', 'అవును']);
  await f.begin();
  assert.deepEqual(f.spoken, ['te నమస్కారం రవి గారు, నేను సాథి నుండి మాట్లాడుతున్నాను.']);
  await f.turn(); assert.ok(f.spoken.includes('te ఈ నెల జీతం వచ్చిందా?'));            // "హలో" is not thrown away as filler
  assert.ok(!f.stops.includes('close'));
  await f.turn(); assert.ok(f.spoken.includes('te సరే, నమోదు చేశాను. జాగ్రత్తగా ఉండండి.'));   // "అవును" is an answer
  assert.ok(f.stops.includes('close'));
});

test('Check-in call: the model cannot end the call before record_checkin ran; danger is recorded and the call goes on without a transfer', async () => {
  const early = checkinFixture([{ say_to_worker: 'సరే, జాగ్రత్త.', done: true }], ['అవును']);
  await early.begin(); await early.turn(); assert.ok(!early.stops.includes('close'));
  const reported: string[] = [];
  const f = checkinFixture([], ['నన్ను ఎవరో తీసుకెళ్ళారు'], { check: async () => 'emergency', report: async t => { reported.push(t); return 'మీ సమస్య నమోదైంది.'; } });
  await f.begin(); await f.turn(); await new Promise(r => setTimeout(r, 5));
  assert.equal(reported.length, 1); assert.ok(f.spoken.includes('te మీ సమస్య నమోదైంది.'));
  assert.ok(!f.stops.includes('handoff')); assert.ok(!f.stops.includes('close'));
});

test('Check-in services run the Bolna script with the worker filled in, and the call identity wins over what the model typed', async t => {
  const original = globalThis.fetch; let system = ''; let toolBody: any; let round = 0;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/tools/record-checkin')) { toolBody = JSON.parse(String(init?.body)); return Response.json({ instruction: 'నమోదు చేశాను.' }); }
    const body = JSON.parse(String(init?.body)); system = body.messages[0].content; round++;
    if (round === 1) return Response.json({ choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 'c', type: 'function',
      function: { name: 'record_checkin', arguments: JSON.stringify({ case_id: 'GS-EVIL', call_kind: 'weekly', caller_said: 'జీతం వచ్చింది' }) } }] } }] });
    return Response.json({ choices: [{ message: { content: JSON.stringify({ say_to_worker: 'నమోదు చేశాను.', done: true }) } }] });
  }) as typeof fetch;
  const svc = checkinServices(cfg, 'call', { caseId: 'GS-OK1', kind: 'arrival', phone: '+919000000002',
    vars: { worker_name: 'రవి', employer_name: 'Al Noor', dest_city: 'Dubai', dest_country: 'UAE', promised_job: 'cleaner', code_phrase: 'amma bagunda', alert_text: '' } });
  const step = await svc.think([{ who: 'worker', text: 'హలో' }], 'te');
  assert.ok(system.includes('phoning రవి')); assert.ok(system.includes('Call type: arrival')); assert.ok(system.includes('amma bagunda'));
  assert.equal(step.recorded, true); assert.equal(step.done, true);
  assert.equal(toolBody.case_id, 'GS-OK1'); assert.equal(toolBody.call_kind, 'arrival'); assert.equal(toolBody.caller_phone, '+919000000002');
});

test('the call server answers a Check-in call: reads the case, then starts with the Bolna welcome line', async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes('/api/saathi/checkin-context/GS-CALL1')) return Response.json({ worker_name: 'రవి', employer_name: 'Al Noor', promised_job: 'cleaner', dest_city: 'Dubai', dest_country: 'UAE', code_phrase: '' });
    return original(input, init);
  }) as typeof fetch;
  const spoken: string[] = []; const asked: any[] = [];
  const server = createInterpreter(cfg as any, () => { throw Error('keypad not used'); }, () => { throw Error('agent not used'); }, (_c, _call, ctx) => { asked.push(ctx);
    return { stt: async () => '', think: async () => ({}), check: async () => 'ok', speak: async (tx: string, l: string) => { spoken.push(l + ' ' + tx); return Buffer.from([255]); }, handoff: async () => {} } as AgentServices; });
  server.listen(0, '127.0.0.1'); await once(server, 'listening'); t.after(() => server.close());
  const local = 'http://127.0.0.1:' + (server.address() as { port: number }).port;
  // Plivo V3: decoded query values sorted by key, joined with &, after the origin and path
  const signed = (path: string, nonce: string) => {
    const u = new URL('http://x' + path);
    const query = [...new Set(u.searchParams.keys())].sort().map(k => k + '=' + u.searchParams.get(k)).join('&');
    const data = cfg.origin + u.pathname + (query ? '?' + query : '') + '.' + nonce;
    return fetch(local + path, { headers: { 'x-plivo-signature-v3': createHmac('sha256', 'fixture').update(data).digest('base64'), 'x-plivo-signature-v3-nonce': nonce } });
  };
  assert.equal((await signed('/answer?CallUUID=c1&mode=checkin&case_id=GS-CALL1&kind=bogus', 'n1')).status, 400);      // unknown call kind
  assert.equal((await signed('/answer?CallUUID=c1&mode=checkin&kind=arrival', 'n2')).status, 400);                      // no case
  const xml = await (await signed('/answer?CallUUID=c1&mode=checkin&case_id=GS-CALL1&kind=weekly&To=%2B919000000003', 'n3')).text();
  const endpoint = xml.match(/\/media\/[a-f0-9]+/)![0];
  const ws = new WebSocket(local.replace('http', 'ws') + endpoint); t.after(() => ws.terminate()); await once(ws, 'open');
  const first = once(ws, 'message');
  ws.send(JSON.stringify({ event: 'start', start: { callId: 'c1', streamId: 's', mediaFormat: { encoding: 'audio/x-mulaw', sampleRate: 8000 } } }));
  assert.equal(JSON.parse(String((await first)[0])).event, 'playAudio');
  assert.deepEqual(spoken, ['te నమస్కారం రవి గారు, నేను సాథి నుండి మాట్లాడుతున్నాను.']);
  assert.equal(asked[0].kind, 'weekly'); assert.equal(asked[0].phone, '+919000000003'); assert.equal(asked[0].vars.worker_name, 'రవి');
});

test('unanswered Check-in calls are recorded as missed; answered ones are left to record_checkin', async t => {
  process.env.SAATHI_SECRET = 'fixture';
  const { default: express } = await import('express');
  const { registerSaathi } = await import('../server/saathi.ts');
  const app = express(); app.use(express.json());
  registerSaathi(app, (req, res, next) => (req.query.secret === 'fixture' ? next() : void res.sendStatus(401)));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); t.after(() => { server.close(); });
  const base = 'http://127.0.0.1:' + (server.address() as { port: number }).port + '/webhooks/plivo-status?secret=fixture&kind=arrival&case_id=';
  const post = (id: string, form: Record<string, string>) => fetch(base + id, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(form) }).then(r => r.json());
  await store.addWorker({ caseId: 'GS-MISS', phone: '+919000000004', consent: true, promise: {} });
  assert.equal((await fetch(base.replace('secret=fixture', 'secret=wrong') + 'GS-MISS', { method: 'POST' })).status, 401);   // wrong secret is refused
  const r1: any = await post('GS-MISS', { CallStatus: 'no-answer', CallUUID: 'u1', Duration: '0' });
  assert.equal(r1.missed, true);
  const calls = await store.calls('GS-MISS'); assert.equal(calls.length, 1); assert.equal(calls[0].status, 'no-answer');
  await store.recordAlertCall({ id: 'a1', caseId: 'GS-MISS', kind: 'arrival', at: new Date().toISOString(), status: 'answered', reasons: [] }, () => 1);
  const r2: any = await post('GS-MISS', { CallStatus: 'completed', CallUUID: 'u2', Duration: '60' });
  assert.equal(r2.answered, true); assert.equal((await store.calls('GS-MISS')).length, 2);                         // nothing added after an answered record
  assert.equal(((await post('GS-NOPE', { CallStatus: 'busy' })) as any).ignored, 'unknown case');
});
