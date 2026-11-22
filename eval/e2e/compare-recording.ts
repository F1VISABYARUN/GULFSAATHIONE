// Replay one recording with an optional human transcript. Each row is a run, not a new clip.
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { replayRecording } from './replay-client.ts';
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
const clip = process.env.STT_CLIP_ID || basename(file);
const audio = new Blob([new Uint8Array(await readFile(file))]);
const reference = process.env.STT_REFERENCE ? await readFile(process.env.STT_REFERENCE, 'utf8') : '';
const url = new URL('/api/saathi/stt', process.env.SAATHI_URL || 'http://localhost:3000');
for (let run = 1; run <= runs; run++) {
  for (const model of models) {
    try {
      const result = await replayRecording(audio,file,language,model,secret,url);
      console.log(JSON.stringify({ clip, run, ...result, wer: reference.trim() ? wer(reference, result.text) : null }));
    } catch (error) {
      console.log(JSON.stringify({ clip, run, model, error: String(error) }));
      process.exitCode = 1;
    }
  }
}
