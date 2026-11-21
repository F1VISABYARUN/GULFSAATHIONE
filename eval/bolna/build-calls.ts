// One-off: turn user_turns.md into calls.json (machine-readable caller turns),
// and create facts.json (the fact sheet) if it does not exist yet.
//   npx tsx eval/bolna/build-calls.ts

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const SAATHI = '81ab8c71-83ab-43b0-9145-96cb1975f105';
const CHECKIN = '4ec8d84e-354b-48fa-a5a5-59cd9fe337ce';

const FULL: Record<string, [string, string]> = Object.fromEntries(([
  ['839cab12-d777-432a-a115-f868e4ad226f', SAATHI], ['825a05db-0e43-4caa-9670-73a997c01fe8', SAATHI],
  ['d2d1c8ee-4056-4983-88db-89469b197c0e', SAATHI], ['7f58b4f5-584f-463d-955b-ae61ec4d0342', SAATHI],
  ['6bb7d5c6-ce83-4c79-973f-ae2dba06c1b0', SAATHI], ['22b72629-72de-4122-8093-2130234043bd', SAATHI],
  ['12e3c302-e3ff-4065-954f-5634486b1a1a', SAATHI], ['bc44db4c-0ace-47ef-ba17-ea55fe883975', SAATHI],
  ['3d12bcdc-b025-4ed5-b063-7a8053549eb9', SAATHI], ['d5acc09e-1c07-44fc-9ffb-d044ff274f4b', SAATHI],
  ['2d3958cc-9706-4ea4-aac8-bf5df2b550f8', SAATHI], ['d09a4337-22cc-4059-8a64-c9e52aabe8ff', SAATHI],
  ['94aa6eac-ea58-4773-a05c-23565cadce58', SAATHI], ['9915de46-d1e6-443a-b8c2-14f02260595b', SAATHI],
  ['9eb5cf51-6d19-41b7-a127-8196ad24fc53', SAATHI], ['2c0afbb9-944e-41aa-88b4-908d32f39899', SAATHI],
  ['470ffc46-8b32-48e2-b73c-41903a1a7f1d', SAATHI],
  ['9fdec4d2-b746-4b4b-bd13-c743aa5d9364', CHECKIN], ['60e0c7b3-46b3-4c84-966f-6c49b307747c', CHECKIN],
  ['96d83759-9ad0-4d33-9683-14da6ac3c5df', CHECKIN], ['106017a4-ecca-456c-a5a9-bf5f748ed982', CHECKIN],
  ['26166a1b-035e-4cb7-b592-8ea8d17c2624', CHECKIN], ['2354dfd3-0231-4e74-9ec9-53a763bf8559', CHECKIN],
  ['4eff712a-7c62-4375-9932-56fcf302c796', CHECKIN], ['59dc411a-55ae-41a7-9982-749a1c247e76', CHECKIN],
  ['4825cf9a-03f8-4573-9296-988ab54f0430', CHECKIN], ['8b9f0a31-ac5c-4954-8c3b-2d3327f61782', CHECKIN],
] as [string, string][]).map(([id, agent]) => [id.slice(0, 8), [id, agent]]));

// The bot's question before some short answers (copied from the Bolna transcripts).
// Used by the harness Q/A layer: "లేదు" means nothing without "is your passport with you?".
const QUESTIONS: Record<string, Record<string, string>> = {
  '96d83759': { 'రాలేదండి ఇంకా. నా ఇవ్వలేదు.': 'ఈ నెల జీతం వచ్చిందా?', 'లేదు.': 'మీ పాస్‌పోర్ట్ మీ దగ్గరే ఉందా?' },
  '4eff712a': { 'రాలేదండి. రెండు నెలలు అయింది.': 'ఈ నెల జీతం వచ్చిందా?', 'మా దగ్గర లేదండి అయ్యా. అది. తీసుకున్నాడు ఆ. Arabat అందింది చేసుకున్నాడు.': 'మీ పాస్‌పోర్ట్ మీ దగ్గరే ఉందా?' },
  '60e0c7b3': { 'లేదు వేరే వాళ్ళు.': 'మిమ్మల్ని ఎవరు తీసుకెళ్లారు? AI NOOR CLEANING వాళ్లేనా?' },
  '4825cf9a': { 'అవును.': 'మిమ్మల్ని ఎవరు తీసుకెళ్లారు? AI NOOR CLEANING వాళ్లేనా?' },
  '9fdec4d2': { 'ఆ వాళ్ళే తీసుకుంటారు. తీసుకున్నారు.': 'మిమ్మల్ని ఎవరు తీసుకెళ్లారు? AI NOOR CLEANING వాళ్లేనా?' },
  '26166a1b': { 'లేదు వేరే వాళ్ళు': 'మిమ్మల్ని ఎవరు తీసుకెళ్లడానికి వచ్చారు? మీ యజమాని వాళ్లేనా?' },
};

export interface Turn { text: string; q?: string }
export interface Call { id: string; id8: string; agent: 'saathi' | 'checkin'; date: string; seconds: number; header: string; turns: Turn[]; audio: string }

const md = readFileSync(join(DIR, 'user_turns.md'), 'utf8');
const calls: Call[] = [];
for (const block of md.split(/\n## /).slice(1)) {
  const header = block.split('\n')[0];
  const m = header.match(/^([0-9a-f]{8}) · (\d+ \w+) · (\d+) s/);
  if (!m || !FULL[m[1]]) continue;
  const [id, agentId] = FULL[m[1]];
  const body = block.split('**What broke')[0];
  const turns: Turn[] = body.split('\n')
    .filter(l => l.startsWith('- ') && !l.includes('*(no caller speech') && !l.includes('*(not fetched'))
    .map(l => l.slice(2).trim())
    .filter(t => !/^\*\(.*redacted\)\*$/.test(t))
    .map(text => ({ text: text.replace(/\s+\*\(.*\)\*$/, ''), q: QUESTIONS[m[1]]?.[text.replace(/\s+\*\(.*\)\*$/, '')] }));
  calls.push({ id, id8: m[1], agent: agentId === SAATHI ? 'saathi' : 'checkin', date: m[2], seconds: Number(m[3]), header, turns, audio: `audio/bolna/${id}.mp3` });
}
writeFileSync(join(DIR, 'calls.json'), JSON.stringify(calls, null, 2));
console.log(`calls.json: ${calls.length} calls, ${calls.reduce((a, c) => a + c.turns.length, 0)} caller turns`);

// ---------------------------------------------------------------- fact sheet
// Pre-filled from Claude reading the BASE transcripts. These are GUESSES: scoring the base transcript
// against facts guessed from that same transcript is circular, so the scorer ignores "unverified" calls
// unless you pass --include-guesses. Listen, correct, and mark "verified". Use null for "can't tell".
const G = (facts: Record<string, unknown>, risks: string[], notes = '') => ({ status: 'unverified', source: 'claude-guess-from-transcript', facts, risks, notes });
const FACTS: Record<string, unknown> = {
  '839cab12': G({ agentName: 'Chella Mallesham', district: 'Jagtial', feeINR: 30000, visaType: 'work', country: null }, [], 'Two personas in one call (Yadaiah, then Narasaiah→Dubai). Country for Yadaiah unclear: Oman? Qatar?'),
  '825a05db': G({ visaType: 'visit', feeINR: 300000, country: 'UAE', district: 'Jagtial' }, ['VISIT_VISA', 'FEE_ABOVE_CAP'], 'Amounts said: 10k advance, 3 lakh, later "30,000" — which is true? "దువా కించుకున్నాను" = Dubai?'),
  'd2d1c8ee': G({ agentName: 'Ramaiah', district: 'Karimnagar', feeINR: 500000 }, ['FEE_ABOVE_CAP'], '5 lakh paid, no receipt.'),
  '7f58b4f5': G({ district: 'Nizamabad', feeINR: 500000, visaType: 'work', country: 'Qatar' }, ['FEE_ABOVE_CAP'], 'Said 4 lakh then 5 lakh. "కాతారు" = Qatar?'),
  '6bb7d5c6': G({ agentName: 'Ramesh', district: 'Jagtial', feeINR: 400000, visaType: 'visit', passportHeld: true, salaryPaid: false, distress: ['violence', 'help', 'deprivation'], country: null }, ['DISTRESS', 'VISIT_VISA', 'FEE_ABOVE_CAP', 'PASSPORT_HELD', 'SALARY_UNPAID'], 'Asked 3 lakh, paid 4 lakh? Country: Oman then Qatar — which?'),
  '22b72629': G({ district: 'Karimnagar', feeINR: 500000, visaType: 'work', country: null }, ['FEE_ABOVE_CAP'], '5 lakh asked, nothing paid yet. "యూకే" = UK or Kuwait?'),
  '12e3c302': G({ feeINR: 500000, passportHeld: true, visaType: null, country: null, distress: null }, ['FEE_ABOVE_CAP', 'PASSPORT_HELD'], 'First line "खतर में हूं": danger or Qatar?'),
  'bc44db4c': G({ country: 'UAE', feeINR: 1000000, takenByStranger: true, passportHeld: true, salaryPaid: false, distress: ['violence', 'help'], job: 'farm worker' }, ['DISTRESS', 'TAKEN_BY_STRANGER', 'PASSPORT_HELD', 'SALARY_UNPAID', 'FEE_ABOVE_CAP'], 'Promised cooking/cleaning, now farm with cattle.'),
  '3d12bcdc': G({ district: 'Jagtial', country: 'UAE', feeINR: 1500000, visaType: 'visit', salaryPaid: false, job: 'farm worker' }, ['VISIT_VISA', 'SALARY_UNPAID', 'FEE_ABOVE_CAP'], '2 of 6 months paid. "పావిలాక్షల్" = ?'),
  'd5acc09e': G({ agentName: 'Rajesh', district: 'Karimnagar', country: 'Oman', takenByStranger: true, distress: ['violence', 'help', 'deprivation'], job: 'shepherd' }, ['DISTRESS', 'TAKEN_BY_STRANGER'], '"గొర్రె మందులు" = sheep herds? Karimnagar is a guess from "కరేం నాన్న".'),
  '2d3958cc': G({ country: 'UAE', passportHeld: true }, ['PASSPORT_HELD'], 'Passport "lost" or taken by the sponsor?'),
  'd09a4337': G({ agentName: 'Ramesh', district: 'Nizamabad', feeINR: 100000, visaType: 'visit' }, ['FEE_ABOVE_CAP', 'VISIT_VISA'], 'Agent promises tourist visa → work permit later.'),
  '94aa6eac': G({ feeINR: 1500000, phones: ['+91 98480 12345'] }, ['FEE_ABOVE_CAP'], 'Phone is a test number.'),
  '9eb5cf51': G({ feeINR: 200000 }, ['FEE_ABOVE_CAP']),
  '2c0afbb9': G({ country: 'UAE' }, []),
  '470ffc46': G({ takenByStranger: true }, ['TAKEN_BY_STRANGER']),
  '9915de46': { status: 'skip', source: 'no-speech', facts: {}, risks: [], notes: 'No caller speech.' },
  '9fdec4d2': G({ country: 'UAE', takenByStranger: true, job: 'cleaner', distress: ['confinement'] }, ['TAKEN_BY_STRANGER', 'DISTRESS'], 'Said "they took me" then "other people took me", then "kidnapped".'),
  '60e0c7b3': G({ country: 'UAE', takenByStranger: true }, ['TAKEN_BY_STRANGER']),
  '96d83759': G({ salaryPaid: false, passportHeld: true }, ['SALARY_UNPAID', 'PASSPORT_HELD'], '3 months unpaid.'),
  '106017a4': G({}, [], 'Briefing call in Hindi; "నై" to cleaning job then "सही है".'),
  '26166a1b': G({ country: 'UAE', takenByStranger: true, passportHeld: true }, ['TAKEN_BY_STRANGER', 'PASSPORT_HELD']),
  '2354dfd3': G({ country: 'UAE', takenByStranger: true }, ['TAKEN_BY_STRANGER'], 'Possible coercion: "told me to say the work is good"?'),
  '4eff712a': G({ salaryPaid: false, passportHeld: true }, ['SALARY_UNPAID', 'PASSPORT_HELD'], 'Passport with arbab ("Arabat").'),
  '59dc411a': G({ country: 'UAE', takenByStranger: true, passportHeld: true, distress: ['confinement'] }, ['TAKEN_BY_STRANGER', 'PASSPORT_HELD', 'DISTRESS'], 'Taken to a room.'),
  '4825cf9a': G({ country: 'UAE', job: 'cleaner', takenByStranger: false }, [], 'Happy path — control clip, nothing should be flagged.'),
  '8b9f0a31': { status: 'skip', source: 'no-speech', facts: {}, risks: [], notes: '6 s, no conversation.' },
};
const factsPath = join(DIR, 'facts.json');
if (!existsSync(factsPath)) {
  writeFileSync(factsPath, JSON.stringify({
    _how: 'status: unverified (Claude guess) | verified (you listened) | skip. Facts: use null when you cannot tell — null fields are not scored. Risks: the risk IDs that SHOULD fire for this call.',
    _fields: ['agentName', 'district', 'country', 'feeINR', 'visaType (work|visit)', 'passportHeld', 'salaryPaid', 'takenByStranger', 'distress [violence, threat, help, deprivation, confinement]', 'job', 'phones'],
    calls: FACTS,
  }, null, 2));
  console.log('facts.json created (all unverified guesses)');
} else console.log('facts.json exists — left untouched');
