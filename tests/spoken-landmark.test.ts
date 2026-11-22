import test from 'node:test';
import assert from 'node:assert/strict';
import { findPlace, voiceDirections } from '../server/voice-maps.ts';
import { checkAgent } from '../server/risk/agents.ts';

test('clipped pharmacy-call landmark requires another utterance before looking up a place or route', async t => {
  const request = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected lookup'); });
  for (const fragment of ['బుర్చ్', 'బొర్ చొ', 'బుర్ష్ కార్']) {
    assert.equal((await findPlace(fragment, 'Dubai', 'pharmacy')).status, 'needs_landmark');
    assert.equal((await voiceDirections(fragment, 'Dubai', 'pharmacy', 'walking')).status, 'needs_landmark');
  }
  assert.equal(request.mock.callCount(), 0);
});

test('one fuzzy Google candidate requires a new utterance with its name before returning distances', async t => {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  process.env.GOOGLE_MAPS_API_KEY = 'fixture';
  t.after(() => { if (key === undefined) delete process.env.GOOGLE_MAPS_API_KEY; else process.env.GOOGLE_MAPS_API_KEY = key; });
  const queries: string[] = [];
  t.mock.method(globalThis, 'fetch', async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    queries.push(body.textQuery);
    return Response.json({places: [{id: 'fixture', displayName: {text: body.locationBias ? 'Test pharmacy' : 'Burj Al Arab'},
      location: {latitude: 25, longitude: 55}}]});
  });
  const first = await findPlace('Arab tower', 'Dubai', 'pharmacy');
  assert.equal(first.status, 'needs_landmark');
  assert.ok('candidate' in first && first.candidate === 'Burj Al Arab');
  assert.equal(queries.length, 1);
  const next = await findPlace('Burj Al Arab', 'Dubai', 'pharmacy');
  assert.equal(next.status, 'found');
  assert.match(next.sayTe, /Test pharmacy/);
  assert.equal(queries[1], 'burj al arab, Dubai');
});

test('Dubai consulate contact can serve a stated Sharjah location without a guessed distance or address', async () => {
  const reply = await findPlace('Clock Tower daggara', 'Sharjah', 'embassy');
  assert.equal(reply.status, 'official');
  assert.ok('places' in reply && reply.places?.[0].place_id === 'mission:Dubai');
  assert.equal(reply.places[0].distance_m, null);
});

test('an explicit registration number is checked against RC and RA identifiers and reports notified coverage', () => {
  const result = checkAgent('', '', 'b-0453/MUM/PER/1000+/5/1563/1984');
  assert.equal(result.match?.raId, 'RA1');
  assert.equal(result.notifiedRegister, process.env.EMIGRATE_NOTIFIED_FILE ? 'needs_district' : 'unavailable');
  assert.equal(checkAgent('Nasir Trade International', 'Mumbai City', 'unknown ID').status, 'not_found');
});
