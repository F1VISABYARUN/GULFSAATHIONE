// Translation invariants through the live relay (/tools/translate): do numbers, negation and key terms survive, and is legal speech withheld?
// This is NOT a quality score; a bilingual reviewer must read the outputs. Usage: SAATHI_SECRET=... npx tsx eval/translation/run.ts [--show]
import { readFileSync } from 'node:fs';
import { tokenize } from '../../server/harness/tokens.ts';
import { numberValues } from '../../server/harness/numbers.ts';

interface Case { id: string; dir: 'ar>te' | 'te>ar'; text: string; kind: string; expect_te?: string[]; expect_ar?: string[]; expect_numbers?: number[]; expect_digits?: string; negative?: boolean; expect_status?: string[]; note?: string }
const { cases } = JSON.parse(readFileSync(new URL('./cases.json', import.meta.url), 'utf8')) as { cases: Case[] };
const NEG_TE = /బడదు|లేదు|లేరు|లేవు|కాదు|వద్దు|కూడదు|లేకుండా|ఇవ్వలేదు|రాలేదు|చేయను|ఇవ్వను|చెల్లించను|ఉండదు|కుదరదు|లేనే|నహీ|ఇవ్వడం లేదు|చేయలేరు|అనుమతి లేదు|చేయకూడదు/;
const NEG_AR = /لا |لن |لم |ليس|ما |مافي|مش |بدون|غير /;
// Arabic-Indic digits to ASCII so "٥٠٠٠" counts as 5000
const ascii = (s: string) => s.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));

// numbers 1-9 are compared by value in digits, or as spoken words in Telugu or Arabic
const SMALL: Record<number, RegExp> = { 1: /ఒక|واحد/, 2: /రెండు|اثن|ثنتين|يومين/, 3: /మూడు|ثلاث/, 4: /నాలుగు|أربع|اربع/, 5: /ఐదు|అయిదు|خمس/, 6: /ఆరు|ست/, 7: /ఏడు|سبع/, 8: /ఎనిమిది|ثمان/, 9: /తొమ్మిది|تسع/ };

export async function call(c: Case, base: string, secret: string) {
  const body = c.dir === 'ar>te' ? { other_said: c.text, target_lang: 'ar' } : { caller_said: c.text, target_lang: 'ar' };
  const r = await fetch(base + '/tools/translate', { method: 'POST', headers: { 'content-type': 'application/json', 'x-saathi-secret': secret }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) });
  return (await r.json()) as Record<string, string>;
}

export function check(c: Case, r: Record<string, string>): string[] {
  const fails: string[] = [];
  if (c.kind === 'must_block' || c.kind === 'danger_escalates') { if (!(c.expect_status ?? []).includes(r.status)) fails.push(`was released (status ${r.status}) but ${c.kind === 'danger_escalates' ? 'distress must escalate' : 'legal speech must be withheld'}`); return fails; }
  if (r.status !== 'translated') { fails.push(`not translated (status ${r.status})`); return fails; }
  const out = c.dir === 'ar>te' ? r.say_to_worker : r.say_to_other;
  const nums = (s: string) => numberValues(tokenize(ascii(s)));
  for (const n of c.expect_numbers ?? []) if (!nums(out).includes(n) && !(n < 10 && (new RegExp(`(^|\\D)${n}(\\D|$)`).test(ascii(out)) || SMALL[n].test(out)))) fails.push(`number ${n} missing`);
  if (c.expect_digits && !ascii(out).replace(/\D/g, '').includes(c.expect_digits)) fails.push('digit string changed');
  for (const re of c.dir === 'ar>te' ? c.expect_te ?? [] : c.expect_ar ?? []) if (!new RegExp(re).test(out)) fails.push(`key term /${re}/ missing`);
  if (c.negative !== undefined) { const neg = (c.dir === 'ar>te' ? NEG_TE : NEG_AR).test(out + ' '); if (neg !== c.negative) fails.push(c.negative ? 'negation lost' : 'negation invented'); }
  return fails;
}

if (process.argv[1]?.endsWith('run.ts')) {
  const base = process.env.SAATHI_URL ?? 'https://gulfsaathione.vercel.app', secret = process.env.SAATHI_SECRET; if (!secret) { console.error('Set SAATHI_SECRET'); process.exit(2); }
  const byKind: Record<string, [number, number]> = {}; const bad: string[] = [];
  for (const c of cases) {
    const r = await call(c, base, secret), f = check(c, r);
    (byKind[c.kind] ??= [0, 0])[1]++; if (!f.length) byKind[c.kind][0]++; else bad.push(`FAIL ${c.id} [${c.dir}] ${f.join('; ')}\n      in : ${c.text}\n      out: ${(c.dir === 'ar>te' ? r.say_to_worker : r.say_to_other) ?? r.say_to_worker ?? ''}  (${r.status})`);
    if (process.argv.includes('--show')) console.log(`${c.id}\n   in : ${c.text}\n   out: ${(c.dir === 'ar>te' ? r.say_to_worker : r.say_to_other) ?? ''}  [${r.status}]`);
  }
  for (const [k, [p, n]] of Object.entries(byKind)) console.log(`${k.padEnd(10)} ${p}/${n} invariants held`);
  console.log(`\n${cases.length} sentences written by Claude, not native speakers; invariants only, not translation quality.`);
  bad.forEach(b => console.log(b));
}
