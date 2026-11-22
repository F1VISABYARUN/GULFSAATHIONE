import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { WebSocket } from 'ws';
process.env.STORE = 'memory';
const { default: express } = await import('express');
const { store } = await import('../server/store.ts');
const { registerCallMe, normalizePhone, callMeMode } = await import('../server/call-me.ts');
const { registerDataSources, dataSources } = await import('../server/data-sources.ts');
const { createInterpreter } = await import('../interpreter/server.ts');

const PLIVO = { PLIVO_AUTH_ID: 'AUTHID', PLIVO_AUTH_TOKEN: 'tok', INTERPRETER_ORIGIN: 'https://phone.example', PLIVO_FROM_NUMBER: '+918065952403', SAATHI_SECRET: 'fixture' };
async function app(t: any) {
  await store.reset();                                  // each test starts with empty limit counters
  const a = express(); a.use(express.json()); registerCallMe(a); registerDataSources(a);
  const server = a.listen(0, '127.0.0.1'); await once(server, 'listening'); t.after(() => { server.close(); });
  const base = 'http://127.0.0.1:' + (server.address() as { port: number }).port;
  const post = (body: object, ip = '1.1.1.1') => fetch(base + '/api/call-me/request', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify(body) });
  return { base, post, get: (path: string) => fetch(base + path) };
}

test('phone numbers are normalised to E.164 and nonsense is refused', () => {
  assert.equal(normalizePhone('98480 12345'), '+919848012345'); assert.equal(normalizePhone('+91 98480-12345'), '+919848012345');
  assert.equal(normalizePhone('919848012345'), '+919848012345'); assert.equal(normalizePhone('09848012345'), '+919848012345');
  assert.equal(normalizePhone('+971501234567'), '+971501234567');
  for (const bad of ['12345', 'abcdefghij', '', '+0123456789', '5848012345', undefined, 12345]) assert.equal(normalizePhone(bad as any), undefined);
});

test('"Get a call" places the call directly: no code step, consent required, Plivo gets the interpreter address and the visitor\'s own number', async t => {
  Object.assign(process.env, PLIVO); t.after(() => { for (const k of Object.keys(PLIVO)) delete process.env[k]; });
  const { post, get } = await app(t);
  assert.deepEqual(await (await get('/api/call-me/status')).json(), { mode: 'direct' });
  const sent: any[] = [];
  const original = globalThis.fetch;
  t.mock.method(globalThis, 'fetch', async (url: unknown, init?: RequestInit) => {
    if (String(url).startsWith('https://api.plivo.com/')) { sent.push({ url: String(url), body: JSON.parse(String(init?.body)), auth: new Headers(init?.headers).get('authorization') }); return Response.json({ request_uuid: 'u1' }); }
    return original(url as any, init);
  });
  assert.equal((await post({ phone: '98480 12345' })).status, 400);                                   // consent missing: nothing sent
  assert.equal((await post({ phone: '12345', consent: true })).status, 400);                            // bad number
  assert.equal(sent.length, 0);
  const ok = await post({ phone: '98480 12345', consent: true });
  assert.equal(ok.status, 200); assert.deepEqual(await ok.json(), { status: 'requested', ref: 'u1' });
  assert.equal(sent[0].url, 'https://api.plivo.com/v1/Account/AUTHID/Call/'); assert.match(sent[0].auth, /^Basic /);
  assert.equal(sent[0].body.to, '919848012345'); assert.equal(sent[0].body.from, '918065952403');
  const answer = new URL(sent[0].body.answer_url);
  assert.equal(answer.origin + answer.pathname, 'https://phone.example/answer');
  assert.equal(sent[0].body.hangup_method, 'POST'); assert.match(sent[0].body.hangup_url, /\/api\/call-me\/hangup\?k=[0-9a-f]{64}$/);
  assert.equal(answer.searchParams.get('mode'), 'agent'); assert.equal(answer.searchParams.get('caller_phone'), '+919848012345');
});

test('limits: two calls a day per number, ten requests an hour per network, and a daily total', async t => {
  Object.assign(process.env, PLIVO, { CALL_ME_DAILY_MAX: '5' }); t.after(() => { for (const k of [...Object.keys(PLIVO), 'CALL_ME_DAILY_MAX']) delete process.env[k]; });
  const { post } = await app(t);
  const original = globalThis.fetch; let calls = 0;
  t.mock.method(globalThis, 'fetch', async (url: unknown, init?: RequestInit) => String(url).startsWith('https://api.plivo.com/') ? (calls++, Response.json({ request_uuid: 'u' })) : original(url as any, init));
  const body = { phone: '9848000001', consent: true };
  assert.equal((await post(body, '2.2.2.2')).status, 200); assert.equal((await post(body, '2.2.2.2')).status, 200);
  const third = await post(body, '2.2.2.2'); assert.equal(third.status, 429); assert.equal((await third.json() as any).status, 'too_many_calls');
  assert.equal(calls, 2);
  for (let i = 0; i < 3; i++) assert.equal((await post({ phone: '98480000' + (10 + i), consent: true }, '3.3.3.3')).status, 200);   // total now 5
  const over = await post({ phone: '9848000099', consent: true }, '4.4.4.4'); assert.equal(over.status, 429); assert.equal((await over.json() as any).status, 'daily_limit');
});

test('approved-numbers mode and closed mode', async t => {
  Object.assign(process.env, PLIVO, { CALL_ME_ALLOWLIST: '+919848012345' }); t.after(() => { for (const k of [...Object.keys(PLIVO), 'CALL_ME_ALLOWLIST']) delete process.env[k]; });
  const { post } = await app(t);
  const original = globalThis.fetch;
  t.mock.method(globalThis, 'fetch', async (url: unknown, init?: RequestInit) => String(url).startsWith('https://api.plivo.com/') ? Response.json({ request_uuid: 'u' }) : original(url as any, init));
  assert.equal(callMeMode(), 'approved');
  assert.equal((await post({ phone: '9848012345', consent: true })).status, 200);
  const no = await post({ phone: '9000000000', consent: true }); assert.equal(no.status, 403); assert.equal((await no.json() as any).status, 'not_approved');
  delete process.env.PLIVO_AUTH_TOKEN; assert.equal(callMeMode(), 'closed');
  assert.equal((await post({ phone: '9848012345', consent: true })).status, 503);
});

test('the data page numbers come from the data files, and every dataset states its source and its limits', () => {
  const sources = dataSources();
  const ra = JSON.parse(readFileSync('server/data/ra_list.json', 'utf8'));
  assert.equal(sources.find(s => s.id === 'ra_list')!.count, ra.agents.length + ra.state_agents.length);
  assert.equal(sources.find(s => s.id === 'missions')!.count, JSON.parse(readFileSync('server/data/missions.json', 'utf8')).length);
  const exit = sources.find(s => s.id === 'exit_rules') as any;
  assert.ok(exit.confirmedFigures > 0 && exit.countriesWithFigures.includes('UAE')); assert.ok(exit.confirmedFigures <= exit.listedFigures);
  const dist = sources.find(s => s.id === 'districts') as any; assert.equal(dist.count, dist.names.length); assert.ok(dist.mandals > dist.count); assert.match(dist.limits, /only these districts/);
  for (const s of sources) assert.ok(s.limits || (s as any).id === 'districts', s.id);
  for (const s of sources.filter(x => x.kind === 'government')) assert.ok(((s as any).sources ?? []).every((u: string) => u.startsWith('https://')), s.id);
});

test('the website has the feature section, the call form and the data page, and the data page loads its script', () => {
  const home = readFileSync('public/index.html', 'utf8'), data = readFileSync('public/data.html', 'utf8');
  for (const needle of ['id="layer"', 'id="callform"', 'id="phone"', 'id="consent"', 'href="/data.html"', '/site/call.js', '/site/extra.css', 'MADAD', 'BEFORE', 'DURING THE CALL', 'AFTER THE CALL']) assert.ok(home.includes(needle), needle);
  for (const needle of ['id="datagrid"', '/site/data.js', 'What is kept about you', 'id="lang"']) assert.ok(data.includes(needle), needle);
  assert.ok(!/files? (a|the) MADAD complaint for/i.test(home));     // we never claim to file it
  const missing = [...home.matchAll(/<(h3|li|p|label|button|span)([^>]*)>([^<]{12,})</g)].filter(m => /id="(callform|phone)"/.test(m[2]) === false && m[2].includes('data-te') === false && !/class="(brand|mark|eyebrow|note|engcap|arrow|audio-bars|stepnum)/.test(m[2]));
  assert.ok(missing.length < 40, 'new copy should carry Telugu: ' + missing.slice(0, 3).map(m => m[3]).join(' | '));
});

test('the call server uses the number a call was placed to (caller_phone) as the person\'s number', async t => {
  const cfg = { origin: 'https://phone.example', backend: 'https://api.example', secret: 'fixture', authId: 'fixture', authToken: 'fixture', human: '+19999999999', openai: 'fixture', target: 'ar' };
  const seen: (string | undefined)[] = [];
  const server = createInterpreter(cfg as any, () => { throw Error('x'); }, (_c, _call, _case, from) => { seen.push(from); return { stt: async () => '', think: async () => ({}), check: async () => 'ok', speak: async () => Buffer.from([255]), handoff: async () => {} } as any; });
  server.listen(0, '127.0.0.1'); await once(server, 'listening'); t.after(() => server.close());
  const local = 'http://127.0.0.1:' + (server.address() as { port: number }).port;
  const signed = (path: string, nonce: string) => { const u = new URL('http://x' + path); const q = [...new Set(u.searchParams.keys())].sort().map(k => k + '=' + u.searchParams.get(k)).join('&');
    return fetch(local + path, { headers: { 'x-plivo-signature-v3': createHmac('sha256', 'fixture').update(cfg.origin + u.pathname + (q ? '?' + q : '') + '.' + nonce).digest('base64'), 'x-plivo-signature-v3-nonce': nonce } }); };
  const xml = await (await signed('/answer?CallUUID=c9&mode=agent&caller_phone=%2B919848012345&From=918065952403&Direction=outbound', 'n1')).text();
  const endpoint = xml.match(/\/media\/[a-f0-9]+/)![0];
  const ws = new WebSocket(local.replace('http', 'ws') + endpoint); t.after(() => ws.terminate()); await once(ws, 'open');
  const first = once(ws, 'message'); ws.send(JSON.stringify({ event: 'start', start: { callId: 'c9', streamId: 's', mediaFormat: { encoding: 'audio/x-mulaw', sampleRate: 8000 } } })); await first;
  assert.deepEqual(seen, ['+919848012345']);
});

test('a failed Plivo request gives the allowance back; a call that never rang gives the number its slot back; the hangup report needs the key', async t => {
  Object.assign(process.env, PLIVO); t.after(() => { for (const k of Object.keys(PLIVO)) delete process.env[k]; });
  const { post, base } = await app(t);
  const original = globalThis.fetch; let accept = false; let hangup = '';
  t.mock.method(globalThis, 'fetch', async (url: unknown, init?: RequestInit) => {
    if (!String(url).startsWith('https://api.plivo.com/')) return original(url as any, init);
    if (accept) { hangup = JSON.parse(String(init?.body)).hangup_url; return Response.json({ request_uuid: 'u9' }); }
    return Response.json({ error: 'rejected' }, { status: 400 });
  });
  const body = { phone: '9848000777', consent: true };
  for (let i = 0; i < 3; i++) assert.equal((await post(body, '5.5.5.5')).status, 502);     // refused three times, still not "too many"
  accept = true;
  assert.equal((await post(body, '5.5.5.5')).status, 200); assert.equal((await post(body, '5.5.5.5')).status, 200);
  assert.equal((await post(body, '5.5.5.5')).status, 429);                                   // two queued calls use the two slots
  const report = (url: string, fields: object) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields as Record<string, string>) });
  assert.equal((await report(base + '/api/call-me/hangup?k=wrong', { To: '919848000777' })).status, 403);
  assert.equal((await report(hangup.replace('https://gulfsaathione.vercel.app', base), { To: '919848000777', CallStatus: 'no-answer', Duration: '0', HangupCauseName: 'Rejected', HangupSource: 'Carrier' })).status, 200);
  assert.equal((await post(body, '5.5.5.5')).status, 200);                                   // slot returned after the rejected call
});

test('a request refused by the per-number limit does not use up the network allowance', async t => {
  Object.assign(process.env, PLIVO); t.after(() => { for (const k of Object.keys(PLIVO)) delete process.env[k]; });
  const { post } = await app(t);
  const original = globalThis.fetch;
  t.mock.method(globalThis, 'fetch', async (url: unknown, init?: RequestInit) => String(url).startsWith('https://api.plivo.com/') ? Response.json({ request_uuid: 'u' }) : original(url as any, init));
  const body = { phone: '9848000555', consent: true };
  assert.equal((await post(body, '6.6.6.6')).status, 200); assert.equal((await post(body, '6.6.6.6')).status, 200);
  for (let i = 0; i < 12; i++) assert.equal((await post(body, '6.6.6.6')).status, 429);        // refused repeatedly, never "slow_down" (that would be the 11th network use)
  assert.equal((await post({ phone: '9848000556', consent: true }, '6.6.6.6')).status, 200);   // same network can still ask for another number
});
