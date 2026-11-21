// Download the Bolna call recordings listed in calls.json into eval/audio/bolna/ (not committed to git).
//   node eval/bolna/download-audio.mjs
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const out = join(dir, '..', 'audio', 'bolna');
mkdirSync(out, { recursive: true });
const calls = JSON.parse(readFileSync(join(dir, 'calls.json'), 'utf8'));
for (const c of calls) {
  const file = join(out, `${c.id}.mp3`);
  if (existsSync(file)) { console.log('have', c.id8); continue; }
  const res = await fetch(`https://api.bolna.ai/recordings/call/${c.id}`, { redirect: 'follow' });
  if (!res.ok) { console.log('FAILED', c.id8, res.status); continue; }
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  console.log('got ', c.id8);
}
