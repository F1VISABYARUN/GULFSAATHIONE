import { readFileSync } from 'node:fs';
import { pairedAudio } from './paired-audio.ts';

const [manifest, observations, split,...models]=process.argv.slice(2);
if (!manifest || !observations || !['dev','heldout'].includes(split) || !models.length) {
  throw Error('Usage: tsx eval/reliability/score-audio.ts clips.json trials.jsonl dev|heldout MODEL [MODEL ...]');
}
const clips=JSON.parse(readFileSync(manifest,'utf8'));
const trials=readFileSync(observations,'utf8').split(/\r?\n/).filter(s=>s.trim()).map(line=>JSON.parse(line));
console.log(JSON.stringify(pairedAudio(clips,trials,models,split as 'dev'|'heldout'),null,2));
