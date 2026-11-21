import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { assist } from '../server/assistant.ts';
import { checkAgent } from '../server/risk/agents.ts';
import { loadNotified } from '../server/risk/notified.ts';
test('notified match requires exact name and district from configured snapshot',()=>{
  const path=join(mkdtempSync(join(tmpdir(),'gs-agent-')),'snapshot.json');
  const d={source:'https://emigrate.gov.in/test-fixture',asOf:'2026-11-01',agents:[{name:'Fixture Alpha',district:'Jagtial'}]};
  writeFileSync(path,JSON.stringify(d));process.env.EMIGRATE_NOTIFIED_FILE=path;
  assert.equal(checkAgent('Fixture Alpha','jagtial').status,'flagged');
  assert.notEqual(checkAgent('Fixture Alpha').status,'flagged');
  assert.notEqual(checkAgent('Fixture Alpha','Dubai').status,'flagged');
  writeFileSync(path,JSON.stringify({...d,source:'https://example.org'}));
  assert.throws(()=>loadNotified(path)); delete process.env.EMIGRATE_NOTIFIED_FILE;
});
test('landmark search returns provider places and degrades on a network error',async t=>{
  process.env.GOOGLE_MAPS_API_KEY='fixture';
  t.after(()=>{delete process.env.GOOGLE_MAPS_API_KEY;});
  const mock=t.mock.method(globalThis,'fetch',async()=>Response.json({places:[{displayName:{text:'Test restaurant'}}]}));
  const query='Burj Khalifa daggara Indian hotel kavali';
  assert.match((await assist(query)).sayTe,/Test restaurant/);
  mock.mock.mockImplementation(async()=>{throw Error('timeout');});
  assert.equal((await assist(query)).liveSearch,'not_configured');
});
