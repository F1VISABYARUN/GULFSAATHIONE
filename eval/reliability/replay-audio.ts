// Input and output contain private call material; write only to a new, private file.
import { createHash } from 'node:crypto';
import { open, readFile } from 'node:fs/promises';
import { dirname,resolve } from 'node:path';
import { STT_MODELS } from '../../server/stt/providers.ts';
import { replayRecording } from '../e2e/replay-client.ts';
import { pairedAudio, type Clip } from './paired-audio.ts';

const [manifest,dest,split,...models]=process.argv.slice(2);
const repeats=Number(process.env.STT_RUNS??1);
const secret=process.env.SAATHI_SECRET;
if (!secret || !manifest || !dest || !(split==='dev'||split==='heldout') ||
    !models.length || models.some(m=>!STT_MODELS.includes(m)) || !Number.isSafeInteger(repeats) || repeats<1) {
  throw Error('Set SAATHI_SECRET. Usage: tsx eval/reliability/replay-audio.ts clips.json NEW-trials.jsonl dev|heldout MODEL [MODEL ...]');
}
const clips:(Clip & {audio:string;sha256:string})[]=JSON.parse(await readFile(manifest,'utf8'));
pairedAudio(clips,[],models,split);
const url=new URL('/api/saathi/stt',process.env.SAATHI_URL || 'http://localhost:3000');
const out=await open(dest,'wx',0o600);
try {
  for (const c of clips.filter(c=>c.status==='verified' && c.split===split)) {
    const file=resolve(dirname(manifest),c.audio);
    const bytes=await readFile(file);
    if (createHash('sha256').update(bytes).digest('hex')!==c.sha256) throw Error('Audio digest mismatch on '+c.id);
    const audio=new Blob([new Uint8Array(bytes)]);
    for (let run=1;run<=repeats;run++) {
      for (const model of models) {
        let observation;
        try {
          const result=await replayRecording(audio,file,c.direction.split('-')[0],model,secret,url);
          observation={text:result.text,ms:result.ms};
        } catch (e) {
          observation={error:String(e)};
          process.exitCode=1;
        }
        await out.writeFile(JSON.stringify({clip:c.id,model,run,...observation})+'\n');
      }
    }
  }
} finally {await out.close();}
