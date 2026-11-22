// Read-only Saathi release checks. The empty STT request stops at input validation.
import { pathToFileURL } from 'node:url';

type Check = { check: string; status: 'pass' | 'fail' | 'skipped'; detail: string };

export async function smokeRelease(origin: string, secret?: string, revision?: string,
  request: typeof fetch = fetch): Promise<Check[]> {
  const base = new URL(origin);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
  if ((base.protocol !== 'https:' && !(base.protocol === 'http:' && loopback))
      || base.username || base.password || base.pathname !== '/' || base.search || base.hash)
    throw new Error('Supply an HTTPS origin or HTTP loopback origin without credentials, path or query.');
  if (revision && !/^[0-9a-f]{7,40}$/i.test(revision)) throw new Error('Expected revision must be a Git commit hash.');
  const results: Check[] = [];
  async function check(label: string, path: string, method: string, useSecret: boolean,
    inspect: (r: Response) => Promise<boolean> | boolean) {
    let response: Response | undefined;
    try {
      response = await request(new URL(path, base), {
        method, headers: useSecret ? { 'x-saathi-secret': secret! } : {},
        redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(15000),
      });
      const pass = await inspect(response);
      results.push({ check: label, status: pass ? 'pass' : 'fail', detail: 'HTTP ' + response.status });
      return pass;
    } catch {
      results.push({ check: label, status: 'fail', detail: 'Connection, timeout or response format error' });
      return false;
    } finally {
      if (response?.body && !response.bodyUsed) await response.body.cancel();
    }
  }
  let deployed: string | undefined;
  const health = await check('Saathi health', '/api/health', 'GET', false, async r => {
    if (r.status !== 200 || !r.headers.get('content-type')?.includes('application/json')) return false;
    const body = await r.json();
    deployed = typeof body.revision === 'string' && /^[0-9a-f]{40}$/i.test(body.revision) ? body.revision : undefined;
    return body.ok === true && typeof body.sttModel === 'string';
  });
  if (!health) return results;
  results.push({ check: 'Deployed commit', status: !revision ? 'skipped' :
    deployed?.toLowerCase().startsWith(revision.toLowerCase()) ? 'pass' : 'fail',
    detail: deployed || 'Revision unavailable' });

  const denied = (r: Response) => r.status === 401 || r.status === 403;
  await check('Private fact sheet', '/facts.html', 'HEAD', false, denied);
  await check('Private call audio mount', '/audio/bolna/release-smoke-unavailable.wav', 'HEAD', false, denied);
  await check('STT rejects anonymous requests', '/api/saathi/stt', 'POST', false, denied);
  if (secret) {
    await check('STT accepts credential and validates empty input', '/api/saathi/stt', 'POST', true, async r =>
      r.status === 400 && (await r.json()).error === 'audio file required');
  } else {
    results.push({ check: 'Authenticated STT validation', status: 'skipped', detail: 'SAATHI_SECRET unavailable' });
  }
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const origin = process.argv[2] || 'https://gulfsaathione.vercel.app';
    const results = await smokeRelease(origin, process.env.SAATHI_SECRET, process.env.EXPECTED_REVISION);
    for (const result of results) console.log(result.status, result.check, '—', result.detail);
    if (results.some(r => r.status === 'fail')) process.exitCode = 1;
    else if (results.some(r => r.status === 'skipped')) process.exitCode = 2;
  } catch {
    console.error('Invalid deployment origin or expected revision.');
    process.exitCode = 1;
  }
}
