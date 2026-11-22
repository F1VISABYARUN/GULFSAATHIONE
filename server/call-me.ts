// "Call me": a visitor enters a phone number on the website and Gulf Saathi phones them.
// Direct calls, no code step. Cost and abuse controls: explicit consent, limits per number, per network address and per day,
// and an optional list of approved numbers (CALL_ME_ALLOWLIST) for demos.
import { createHash } from 'node:crypto';
import type { Express, Request, Response } from 'express';
import { store } from './store.ts';

const pepper = () => process.env.CALL_ME_PEPPER || process.env.SAATHI_SECRET || 'unset';
const hash = (value: string) => createHash('sha256').update(pepper() + '|' + value).digest('hex');
const HOUR = 3_600_000, DAY = 86_400_000;

/** Accepts +<country><number>, an Indian mobile as 10 digits, 91XXXXXXXXXX, or 0XXXXXXXXXX. Returns E.164 or undefined. */
export function normalizePhone(input: unknown): string | undefined {
  if (typeof input !== 'string') return;
  const raw = input.replace(/[\s().-]/g, '');
  if (/^\+[1-9]\d{7,14}$/.test(raw)) return raw;
  if (/^[6-9]\d{9}$/.test(raw)) return '+91' + raw;
  if (/^91[6-9]\d{9}$/.test(raw)) return '+' + raw;
  if (/^0[6-9]\d{9}$/.test(raw)) return '+91' + raw.slice(1);
}

const allowlist = () => new Set((process.env.CALL_ME_ALLOWLIST ?? '').split(',').map(x => normalizePhone(x.trim())).filter((x): x is string => Boolean(x)));
const plivoReady = () => Boolean(process.env.PLIVO_AUTH_ID && process.env.PLIVO_AUTH_TOKEN && process.env.INTERPRETER_ORIGIN && process.env.PLIVO_FROM_NUMBER);
/** 'direct': anyone can ask for a call. 'approved': only numbers in CALL_ME_ALLOWLIST (set it to keep a demo to known people). 'closed': Plivo not configured. */
export function callMeMode(): 'direct' | 'approved' | 'closed' {
  if (!plivoReady()) return 'closed';
  return allowlist().size ? 'approved' : 'direct';
}

/** The interpreter call server answers: the same conversation as a call to the number, with the person's own number passed to the tools. */
async function placeCall(phone: string): Promise<boolean> {
  const id = process.env.PLIVO_AUTH_ID!, token = process.env.PLIVO_AUTH_TOKEN!, from = process.env.PLIVO_FROM_NUMBER!;
  const answer = new URL('/answer', process.env.INTERPRETER_ORIGIN!);
  answer.searchParams.set('mode', 'agent'); answer.searchParams.set('caller_phone', phone);
  try {
    const r = await fetch('https://api.plivo.com/v1/Account/' + encodeURIComponent(id) + '/Call/', {
      method: 'POST', headers: { authorization: 'Basic ' + Buffer.from(id + ':' + token).toString('base64'), 'content-type': 'application/json' },
      body: JSON.stringify({ from: from.replace(/^\+/, ''), to: phone.replace(/^\+/, ''), answer_url: answer.toString(), answer_method: 'GET' }), signal: AbortSignal.timeout(15000),
    });
    const receipt: any = r.ok ? await r.json().catch(() => ({})) : {};
    return r.ok && typeof receipt.request_uuid === 'string';
  } catch { return false; }
}

const clientKey = (req: Request) => hash('ip|' + String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',')[0].trim());
const say = (res: Response, code: number, status: string) => res.status(code).json({ status });

export function registerCallMe(app: Express) {
  app.get('/api/call-me/status', (_req, res) => { res.set('Cache-Control', 'no-store'); res.json({ mode: callMeMode() }); });

  app.post('/api/call-me/request', async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    try {
      const phone = normalizePhone(req.body?.phone);
      if (!phone) return say(res, 400, 'bad_number');
      if (req.body?.consent !== true) return say(res, 400, 'consent_required');
      const mode = callMeMode();
      if (mode === 'closed') return say(res, 503, 'closed');
      if (mode === 'approved' && !allowlist().has(phone)) return say(res, 403, 'not_approved');
      if (!(await store.allow('net:' + clientKey(req), HOUR, 10))) return say(res, 429, 'slow_down');
      if (!(await store.allow('calls:' + hash(phone), DAY, 2))) return say(res, 429, 'too_many_calls');
      if (!(await store.allow('calls:global', DAY, Number(process.env.CALL_ME_DAILY_MAX || 50)))) return say(res, 429, 'daily_limit');
      return (await placeCall(phone)) ? say(res, 200, 'calling') : say(res, 502, 'call_failed');
    } catch (error) { console.error(error); return say(res, 503, 'unavailable'); }
  });
}
