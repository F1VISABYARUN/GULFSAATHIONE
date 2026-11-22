import { createHash, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';

function sameSecret(actual: string, expected: string): boolean {
  const digest = (s: string) => createHash('sha256').update(s).digest();
  return timingSafeEqual(digest(actual), digest(expected));
}

/** Browser Basic auth works for the fact sheet, its fetches and native audio Range requests. */
export const reviewAccess: RequestHandler = (req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  const secret = process.env.SAATHI_SECRET;
  if (!secret) {
    res.status(503).json({ error: 'Review access is not configured' });
    return;
  }
  const header = req.get('x-saathi-secret');
  if (header && sameSecret(header, secret)) return next();
  const basic = req.get('authorization')?.match(/^Basic ([A-Za-z0-9+/=]+)$/i);
  if (basic && sameSecret(Buffer.from(basic[1], 'base64').toString(), 'review:' + secret)) {
    if (!['GET', 'HEAD'].includes(req.method) && (!req.is('application/json') || req.get('sec-fetch-site') === 'cross-site')) {
      res.sendStatus(403);
      return;
    }
    return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="Saathi call review", charset="UTF-8"');
  res.status(401).json({ error: 'Review credentials required' });
};
