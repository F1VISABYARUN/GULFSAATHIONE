// Seeded property checks: invariants the harness must hold over many generated sentences.
// Run: npm run eval:fuzz [N]. These are generated sentences, not speech; each line reports violations / checks.
import { runHarness, ALL_ON } from '../../server/harness/index.ts';

function rng(seed: number) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
const pick = <T,>(r: () => number, a: T[]) => a[Math.floor(r() * a.length)];
const digits = (r: () => number, n: number, first?: string) => (first ?? String(1 + Math.floor(r() * 9))) + Array.from({ length: n - 1 }, () => Math.floor(r() * 10)).join('');

const TIME_CTX = ['{y} లో నేను ఇండియా వచ్చాను', '{y} నుండి దుబాయ్ లో ఉన్నాను', 'in {y} I joined the company', '{y} year lo visa vachindi', 'since {y} nenu ikkada pani chestunnanu', 'visa {y} varaku untundi'];
const COMMON = ['ఇక్కడ', 'అక్కడ', 'ఎక్కడ', 'ikkada', 'akkada', 'ekkada', 'ikkade', 'ఇక్కడే', 'ఇంకా', 'inka'];
const SENT = ['{w} నేను ఉన్నాను', '{w} వర్షం పడుతోంది', 'nenu {w} unnanu', '{w} ఎవరూ లేరు', 'mee {w} em jarigindi'];
const CUES = ['agent ki {n} ichanu', 'fee {n} kattanu', 'salary {n} dirhams', 'ఏజెంట్ కి {n} ఇచ్చాను', 'commission {n} adigadu'];
const ID_CTX = ['my UAN number is {d}', 'నా యూఏఎన్ నంబర్ {d}', 'account number {d}', 'aadhaar {d}', 'ఖాతా నంబర్ {d}'];

interface Check { name: string; n: number; bad: string[] }
export function run(N = 500, seed = 7): Check[] {
  const r = rng(seed), out: Check[] = [];
  const check = (name: string, gen: () => { text: string; ok: (h: ReturnType<typeof runHarness>) => boolean }) => {
    const c: Check = { name, n: N, bad: [] };
    for (let i = 0; i < N; i++) { const { text, ok } = gen(); const h = runHarness(text, {}, ALL_ON); if (!ok(h)) c.bad.push(text); }
    out.push(c);
  };
  check('year in a time context never becomes money', () => { const y = 1950 + Math.floor(r() * 150); const text = pick(r, TIME_CTX).replace('{y}', String(y)); return { text, ok: h => !h.entities.some(e => e.type === 'money') && h.slots.feeINR === undefined && !h.slots.salary }; });
  check('everyday words (here/there/where) never become Gulf terms', () => { const text = pick(r, SENT).replace('{w}', pick(r, COMMON)); return { text, ok: h => !h.entities.some(e => e.type === 'gulf') }; });
  check('10-digit mobile is a phone, never money', () => { const d = digits(r, 10, String(6 + Math.floor(r() * 4))); const text = pick(r, ['nenu {d} number', 'call me on {d}', 'నా నంబర్ {d}']).replace('{d}', d); return { text, ok: h => h.entities.some(e => e.type === 'phone' && (e.value as { valid: boolean }).valid) && !h.entities.some(e => e.type === 'money') }; });
  check('12-digit string is never stored as a phone number', () => { const d = digits(r, 12, String(2 + Math.floor(r() * 8))); const text = d.startsWith('91') || d.startsWith('971') || d.startsWith('966') ? `number ${digits(r, 12, '2')}` : `నా నంబర్ ${d}`; return { text, ok: h => !h.slots.phones?.length && !h.entities.some(e => e.type === 'money') }; });
  check('named IDs (UAN/account/aadhaar) are stored as IDs with a readback', () => { const d = digits(r, 12 + Math.floor(r() * 4)); const text = pick(r, ID_CTX).replace('{d}', d); return { text, ok: h => !!h.slots.idNumbers?.length && !h.slots.phones?.length && h.readBacks.length > 0 }; });
  check('fee with a cue keeps the exact amount', () => { const n = 5000 + 500 * Math.floor(r() * 300); const text = pick(r, CUES.filter(c => !c.includes('salary'))).replace('{n}', String(n)); return { text, ok: h => h.slots.feeINR === n }; });
  check('salary with a currency keeps the exact amount', () => { const n = 500 + 50 * Math.floor(r() * 100); const text = `salary ${n} dirhams`; return { text, ok: h => h.slots.salary?.amount === n }; });
  return out;
}

if (process.argv[1]?.endsWith('fuzz.ts')) {
  const N = Number(process.argv[2] ?? 500);
  let fails = 0;
  for (const c of run(N)) { fails += c.bad.length ? 1 : 0; console.log(`${c.bad.length ? 'FAIL' : 'ok  '} ${c.name}: ${c.bad.length}/${c.n} violations`); c.bad.slice(0, 3).forEach(t => console.log('     e.g. ' + t)); }
  process.exit(fails ? 1 : 0);
}
