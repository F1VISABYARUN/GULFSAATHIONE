// "Call me": a visitor enters a phone number on the website and Gulf Saathi phones them.
// Direct calls, no code step. Cost and abuse controls: explicit consent, limits per number, per network address and per day,
// and an optional list of approved numbers (CALL_ME_ALLOWLIST) for demos.
import { createHash } from 'node:crypto';
import express from 'express';
import type { Express, Request, Response } from 'express';
import { store } from './store.ts';

const pepper = () => process.env.CALL_ME_PEPPER || process.env.SAATHI_SECRET || 'unset';
const hash = (value: string) => createHash('sha256').update(pepper() + '|' + value).digest('hex');
const HOUR = 3_600_000, DAY = 86_400_000;
/** A positive whole number from the environment, else the default. Limits can be raised for a demo without a code change. */
const limit = (name: string, fallback: number) => { const n = Number(process.env[name]); return Number.isInteger(n) && n > 0 ? n : fallback; };

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

const mask = (phone: string) => phone.slice(0, 3) + '*'.repeat(Math.max(0, phone.length - 7)) + phone.slice(-4);
const hangupKey = () => hash('callme-hangup');
/** Where Plivo reports how the call ended. It is our own address, so a carrier rejection leaves evidence in our logs instead of a 404. */
const hangupUrl = () => {
  const url = new URL('/api/call-me/hangup', process.env.SAATHI_BASE_URL || 'https://gulfsaathione.vercel.app');
  url.searchParams.set('k', hangupKey());
  return url.toString();
};

/** The interpreter call server answers: the same conversation as a call to the number, with the person's own number passed to the tools.
 *  Plivo accepting the request only means the call was queued; it says nothing about the phone ringing. */
async function placeCall(phone: string): Promise<{ ok: boolean; uuid?: string }> {
  const id = process.env.PLIVO_AUTH_ID!, token = process.env.PLIVO_AUTH_TOKEN!, from = process.env.PLIVO_FROM_NUMBER!;
  const answer = new URL('/answer', process.env.INTERPRETER_ORIGIN!);
  answer.searchParams.set('mode', 'agent'); answer.searchParams.set('caller_phone', phone);
  try {
    const r = await fetch('https://api.plivo.com/v1/Account/' + encodeURIComponent(id) + '/Call/', {
      method: 'POST', headers: { authorization: 'Basic ' + Buffer.from(id + ':' + token).toString('base64'), 'content-type': 'application/json' },
      body: JSON.stringify({ from: from.replace(/^\+/, ''), to: phone.replace(/^\+/, ''), answer_url: answer.toString(), answer_method: 'GET',
        hangup_url: hangupUrl(), hangup_method: 'POST' }), signal: AbortSignal.timeout(15000),
    });
    const receipt: any = await r.json().catch(() => ({}));
    const uuid = typeof receipt.request_uuid === 'string' ? receipt.request_uuid : undefined;
    console.info(JSON.stringify({ component: 'call-me', event: 'plivo_response', http: r.status, to: mask(phone), uuid, error: r.ok ? undefined : String(receipt.error ?? receipt.message ?? '').slice(0, 200) }));
    return { ok: r.ok && Boolean(uuid), uuid };
  } catch (error) { console.error(JSON.stringify({ component: 'call-me', event: 'plivo_error', to: mask(phone), error: String((error as Error).message).slice(0, 200) })); return { ok: false }; }
}

const clientKey = (req: Request) => hash('ip|' + String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',')[0].trim());
const say = (res: Response, code: number, status: string) => res.status(code).json({ status });

export function registerCallMe(app: Express) {
  app.get('/api/call-me/status', (_req, res) => { res.set('Cache-Control', 'no-store'); res.json({ mode: callMeMode() }); });

  // Plivo's report of how a website call ended. Fields are logged as received (names are Plivo's; the number is masked).
  // A call that never connected (no duration, not completed) gives that number its daily slot back.
  app.post('/api/call-me/hangup', express.urlencoded({ extended: false, limit: '20kb' }), async (req: Request, res: Response) => {
    if (req.query.k !== hangupKey()) return res.sendStatus(403);
    const b = req.body ?? {}, to = typeof b.To === 'string' ? '+' + b.To.replace(/^\+/, '') : '';
    const seconds = Number(b.Duration ?? 0) || 0, status = String(b.CallStatus ?? ''), unanswered = seconds === 0 && status !== 'completed';
    console.info(JSON.stringify({ component: 'call-me', event: 'hangup', uuid: String(b.CallUUID ?? '').slice(0, 60), status, cause: b.HangupCauseName ?? b.HangupCause, code: b.HangupCauseCode ?? b.HangupCause,
      source: b.HangupSource, seconds, to: to ? mask(to) : undefined, unanswered }));
    if (unanswered && normalizePhone(to)) await store.refund('calls:' + hash(normalizePhone(to)!)).catch(() => {});
    res.json({ ok: true });
  });

  app.post('/api/call-me/request', async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    try {
      const phone = normalizePhone(req.body?.phone);
      if (!phone) return say(res, 400, 'bad_number');
      if (req.body?.consent !== true) return say(res, 400, 'consent_required');
      const mode = callMeMode();
      if (mode === 'closed') return say(res, 503, 'closed');
      if (mode === 'approved' && !allowlist().has(phone)) return say(res, 403, 'not_approved');
      const keys = ['net:' + clientKey(req), 'calls:' + hash(phone), 'calls:global'], taken: string[] = [];
      const take = async (key: string, windowMs: number, max: number) => { const ok = await store.allow(key, windowMs, max); if (ok) taken.push(key); return ok; };
      const refuse = async (code: number, status: string) => { await Promise.all(taken.map(k => store.refund(k))); return say(res, code, status); };   // a refused request must not use up the other limits
      if (!(await take(keys[0], HOUR, limit('CALL_ME_NET_PER_HOUR', 10)))) return refuse(429, 'slow_down');
      if (!(await take(keys[1], DAY, limit('CALL_ME_PER_NUMBER_PER_DAY', 2)))) return refuse(429, 'too_many_calls');
      if (!(await take(keys[2], DAY, limit('CALL_ME_DAILY_MAX', 50)))) return refuse(429, 'daily_limit');
      const placed = await placeCall(phone);
      if (!placed.ok) {                                   // nothing was queued: give the allowance back
        return refuse(502, 'call_failed');
      }
      return res.status(200).json({ status: 'requested', ref: placed.uuid });
    } catch (error) { console.error(error); return say(res, 503, 'unavailable'); }
  });
}
