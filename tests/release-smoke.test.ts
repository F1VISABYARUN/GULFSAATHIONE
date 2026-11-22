import { test } from 'node:test';
import assert from 'node:assert/strict';
import { smokeRelease } from '../scripts/smoke-release.ts';

const revision = 'abc1234'.padEnd(40, '0');
function fixture(health: Response, guarded = true) {
  const calls: { method?: string; path: string; secret: string | null }[] = [];
  const request: typeof fetch = async (input, init) => {
    const path = new URL(String(input)).pathname;
    const secret = new Headers(init?.headers).get('x-saathi-secret');
    calls.push({ method: init?.method, path, secret });
    assert.equal(init?.redirect, 'manual');
    assert.equal(init?.body, undefined);
    if (path === '/api/health') return health;
    if (path === '/api/saathi/stt' && secret === 'fixture') {
      return Response.json({ error: 'audio file required' }, { status: 400 });
    }
    return new Response(null, {status: guarded ? 401 : 200});
  };
  return { request, calls };
}

test('release probe verifies deployed revision, checks guards without reading records and sends no audio', async () => {
  const { request, calls } = fixture(Response.json({ ok: true, sttModel: 'model', revision }));
  const checks = await smokeRelease('https://example.com', 'fixture', 'abc1234', request);
  assert.equal(checks.length, 6);
  assert.ok(checks.every(c => c.status === 'pass'));
  assert.deepEqual(calls.filter(c => c.secret), [{method:'POST', path:'/api/saathi/stt', secret:'fixture'}]);
});

test('missing secret, stale revision and open routes stay visible', async () => {
  const { request } = fixture(Response.json({ ok:true, sttModel:'model', revision }), false);
  const checks = await smokeRelease('http://localhost:3000', undefined, 'def0000', request);
  assert.equal(checks[1].status, 'fail');
  assert.equal(checks.find(c => c.check === 'Private fact sheet')?.status, 'fail');
  assert.equal(checks.at(-1)?.status, 'skipped');
});

test('unreachable, redirected or unrelated origins cannot receive a credential', async () => {
  for (const response of [Response.redirect('https://example.org'), Response.json({ ok:true })]) {
    const {request, calls} = fixture(response);
    const result = await smokeRelease('https://example.com', 'fixture', undefined, request);
    assert.deepEqual(result.map(c => c.status), ['fail']);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].secret, null);
  }
  await assert.rejects(smokeRelease('http://example.org', 'fixture'));
  await assert.rejects(smokeRelease('https://example.org/api?key=test'));
});
