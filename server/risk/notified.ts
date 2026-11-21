// Operator supplies a reviewed transcription of an official export, with its publication date.
import { readFileSync } from 'node:fs';
export interface NotifiedAgent { name:string; district:string }
export function loadNotified(path?:string): {source:string;asOf:string;agents:NotifiedAgent[]} | undefined {
  if (!path) return;
  const d=JSON.parse(readFileSync(path,'utf8'));
  const url=new URL(d.source);
  if (url.protocol!=='https:' || !/^(?:[a-z0-9-]+\.)*emigrate\.gov\.in$/.test(url.hostname)
      || !/^\d{4}-\d{2}-\d{2}$/.test(d.asOf) || !Array.isArray(d.agents) || !d.agents.length
      || !d.agents.every((a:NotifiedAgent)=>typeof a?.name==='string' && a.name.trim() && typeof a.district==='string' && a.district.trim()))
    throw Error('Invalid notified agent snapshot');
  return d;
}
