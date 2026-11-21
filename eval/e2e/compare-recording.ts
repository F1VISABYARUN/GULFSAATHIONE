// Replay one recording with an optional human transcript. Each row is a run, not a new clip.
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { wer } from './lib.ts';
import { STT_MODELS } from '../../server/stt/providers.ts';

const [file, language, ...models] = process.argv.slice(2);
const runs = Number(process.env.STT_RUNS || 1);
const secret = process.env.SAATHI_SECRET;
if (!file || !language || !models.length || !secret || !Number.isInteger(runs) || runs < 1 ||
    !models.every(model => STT_MODELS.includes(model))) {
  console.error('Set SAATHI_SECRET. Usage: npm run stt:compare -- AUDIO LANGUAGE MODEL [MODEL ...]');
  process.exit(2);
}
const audio = new Blob([new Uint8Array(await readFile(file))]);
const reference = process.env.STT_REFERENCE ? await readFile(process.env.STT_REFERENCE, 'utf8') : '';
const url = new URL('/api/saathi/stt', process.env.SAATHI_URL || 'http://localhost:3000');
for (let run = 1; run <= runs; run++) {
  for (const model of models) {
    const body = new FormData();
    body.append('audio', audio, basename(file));
    body.append('model', model);
    if (language !== 'auto') body.append('language', language);
    try {
      const response = await fetch(url, { method: 'POST', body, headers: { 'x-saathi-secret': secret },
        signal: AbortSignal.timeout(65000) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'HTTP ' + response.status);
      console.log(JSON.stringify({ run, ...result, wer: reference.trim() ? wer(reference, result.text) : null }));
    } catch (error) {
      console.error(JSON.stringify({ run, model, error: String(error) }));
      process.exitCode = 1;
    }
  }
}
