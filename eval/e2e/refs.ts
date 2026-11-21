// What does the harness invent on the HUMAN transcripts? (No speech recognition involved, so any entity it adds here is a harness error
// unless the sentence really contains it.) Prints every entity for manual review. Usage: EVAL_DATA=... npx tsx eval/e2e/refs.ts
import { loadItems } from './lib.ts';
import { runHarness, ALL_ON } from '../../server/harness/index.ts';
const items = loadItems(process.env.EVAL_DATA!).filter(i => (i.pack === 'fleurs60' && i.cond === 'clean_16k') || i.pack === 'indicvoices10');
const counts: Record<string, number> = {};
for (const i of items) {
  const h = runHarness(i.ref, {}, ALL_ON);
  const ents = h.entities.filter(e => !e.superseded && !['distress'].includes(e.type));
  const personal = /iv_te_0[678]/.test(i.id);
  for (const e of ents) { counts[`${i.pack}:${e.type}`] = (counts[`${i.pack}:${e.type}`] ?? 0) + 1; }
  if (ents.length) console.log(`${i.id.padEnd(30)} ${ents.map(e => personal && ['phone', 'idnumber'].includes(e.type) ? `${e.type}:<digits withheld>` : `${e.type}:${e.surface}→${e.text}`).join(' | ').slice(0, 300)}${h.readBacks.length ? `  [${h.readBacks.length} readback]` : ''}`);
}
console.log('\nentity counts on human transcripts:', counts);
