import test from 'node:test';
import assert from 'node:assert/strict';
import { transcribeRecording } from '../server/stt/providers.ts';

const wav = { size: 2, originalname: 'a.wav', mimetype: 'audio/wav', buffer: Buffer.from('ab') } as Express.Multer.File;
test('Gemini receives audio and returns only completed non-thought speech', async t => {
  const previous = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'fixture';
  t.after(() => { if (previous === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previous; });
  let reason = 'STOP';
  t.mock.method(globalThis, 'fetch', async (_url: string, init: {body: string, headers: Record<string,string>}) => {
    const request = JSON.parse(init.body);
    assert.equal(request.contents[0].parts[1].inlineData.data, 'YWI=');
    assert.equal(init.headers['x-goog-api-key'], 'fixture');
    return Response.json({ candidates: [{ finishReason: reason, content: { parts: [{thought:true,text:'hidden'}, {text:'లేదు'}] } }] });
  });
  const run = () => transcribeRecording(wav, 'gemini-2.5-flash', 'te', '');
  assert.equal((await run()).text, 'లేదు');
  reason = 'MAX_TOKENS';
  await assert.rejects(run, /incomplete/);
  await assert.rejects(transcribeRecording({...wav, size:15000000}, 'gemini-2.5-flash','te',''), /limit/);
});
test('Sarvam uses native transcription and reports empty speech, provider failure and unsupported language', async t => {
  const previous = process.env.SARVAM_API_KEY;
  process.env.SARVAM_API_KEY = 'fixture';
  t.after(() => { if (previous === undefined) delete process.env.SARVAM_API_KEY; else process.env.SARVAM_API_KEY = previous; });
  let status = 200;
  t.mock.method(globalThis, 'fetch', async (_url: string, init: {body: FormData}) => {
    assert.equal(init.body.get('language_code'), 'te-IN');
    assert.equal(init.body.get('mode'), 'transcribe');
    return Response.json({transcript:' '}, {status});
  });
  const run = () => transcribeRecording(wav, 'saaras:v3', 'te', '');
  assert.equal((await run()).status, 'needs_confirm');
  status = 429;
  await assert.rejects(run, /429/);
  await assert.rejects(transcribeRecording(wav,'saaras:v3','ar',''), /Unsupported/);
  delete process.env.SARVAM_API_KEY;
  await assert.rejects(run, /not set/);
});
