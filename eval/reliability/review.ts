// Prepare an audio-first worksheet. Caller transcripts are joined only at scoring time.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Call } from '../bolna/build-calls.ts';

export interface ReviewRow {
  call: string;
  turn: number;
  audio: string;
  status: 'pending' | 'verified' | 'skip';
  speaker: string;
  split: 'dev' | 'heldout';
  truth: Record<string, {state: 'reported' | 'unclear' | 'absent'; value?: unknown}>;
}

export function worksheet(calls: Call[]): ReviewRow[] {
  return calls.flatMap(call => call.turns.map((_, i) => ({
    call: call.id8, turn: i + 1, audio: call.audio, status: 'pending',
    speaker: '', split: 'dev', truth: {},
  })));
}

export function readCatalog(path?: string): Call[] {
  return JSON.parse(readFileSync(path || new URL('../bolna/calls.json', import.meta.url), 'utf8'));
}

export function prepare(path: string, catalogPath?: string) {
  const calls = readCatalog(catalogPath);
  const rows = worksheet(calls);
  writeFileSync(path, JSON.stringify(rows, null, 2), {flag: 'wx', mode: 0o600});
  const localRecordings = calls.filter(c => existsSync(resolve('eval', c.audio))).length;
  console.log(JSON.stringify({worksheet: path, calls: calls.length, turns: rows.length, localRecordings}));
}
