import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runHarness, ALL_OFF, ALL_ON, type HarnessResult } from './harness/index.ts';
import { assessRisks } from './risk/engine.ts';
import { hasKey, transcribe, contextPrompt, llmExtract, safeTranslate } from './stt/openai.ts';
import { gulfTermById } from './harness/terms.ts';
import { loadDataset, EVAL_DIR } from '../eval/evaluate.ts';
import type { CallContext } from './harness/types.ts';
import { loadCalls, loadFacts, saveFacts, scoreCall, contextFor, harnessText } from '../eval/bolna/score.ts';
import { registerLive } from './live.ts';
import { buildCaseFile, renderCaseFileHtml } from './casefile.ts';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
app.use(express.json({ limit: '1mb' }));
app.use(express.static(join(root, 'public')));
app.use('/audio/bolna', express.static(join(root, 'eval', 'audio', 'bolna')));

const view = (h: HarnessResult, promise?: CallContext['promise']) => ({
  transcript: h.input,
  corrected: h.corrected,
  entities: h.entities.map(({ type, text, surface, layer, changed, superseded, risky, score, value }) => ({
    type, text, surface, layer, changed, superseded, risky, score,
    gloss: type === 'gulf' ? gulfTermById(String(value)) : undefined,
  })),
  revisions: h.revisions,
  slots: h.slots,
  readBacks: h.readBacks,
  escalate: h.escalate,
  risks: assessRisks(h.slots, promise),
});

function parseContext(raw: unknown): CallContext {
  if (!raw) return {};
  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return {}; } }
  return raw as CallContext;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, hasKey: hasKey(), sttModel: process.env.OPENAI_STT_MODEL || 'gpt-4o-transcribe' });
});

app.get('/api/dataset', (_req, res) => res.json(loadDataset()));

app.get('/api/results', (_req, res) => {
  for (const f of ['results.json', 'results.reference.json']) {
    const p = join(EVAL_DIR, f);
    if (existsSync(p)) return res.json(JSON.parse(readFileSync(p, 'utf8')));
  }
  res.status(404).json({ error: 'No results yet. Run: npm run eval (audio) or npm run eval -- --reference' });
});

/** Text mode: run base reading and harness on transcripts you paste (no STT). */
app.post('/api/analyze-text', (req, res) => {
  const ctx = parseContext(req.body.context);
  const text = String(req.body.text ?? '');
  const baseText = String(req.body.baseText || text);
  res.json({
    mode: 'text',
    base: view(runHarness(baseText, ctx, ALL_OFF), ctx.promise),
    harness: view(runHarness(text, ctx, ALL_ON), ctx.promise),
  });
});

/** Audio mode: same audio -> base STT vs context-hinted STT + harness. */
app.post('/api/analyze', upload.single('audio'), async (req, res) => {
  if (!hasKey()) return res.status(400).json({ error: 'OPENAI_API_KEY not set on the server' });
  if (!req.file) return res.status(400).json({ error: 'No audio uploaded' });
  const ctx = parseContext(req.body.context);
  const name = req.file.originalname || 'audio.webm';
  try {
    const t0 = Date.now();
    const [base, hinted] = await Promise.all([
      transcribe(req.file.buffer, name),
      transcribe(req.file.buffer, name, contextPrompt(ctx)),
    ]);
    const harness = runHarness(hinted.text, ctx, ALL_ON);
    const baseView = view(runHarness(base.text, ctx, ALL_OFF), ctx.promise);
    let llm;
    if (req.body.llmBaseline === 'true') {
      const slots = await llmExtract(base.text);
      llm = { slots, risks: assessRisks(slots, ctx.promise) };
    }
    let translation;
    if (req.body.translate === 'true') {
      const locked = harness.entities.filter(e => !e.superseded && e.type !== 'distress').map(e => e.text);
      translation = await safeTranslate(harness.corrected, locked);
    }
    res.json({ mode: 'audio', ms: Date.now() - t0, sttModel: base.model, confidence: { base: base.avgLogprob, hinted: hinted.avgLogprob }, base: baseView, baseLlm: llm, harness: view(harness, ctx.promise), translation });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

registerLive(app);

// Case file for one of the recorded Bolna calls
app.get('/api/bolna/casefile/:id8', (req, res) => {
  const c = loadCalls().find(x => x.id8 === String(req.params.id8));
  if (!c) return res.status(404).send('Call not found');
  const cf = buildCaseFile([{ text: harnessText(c.turns), date: c.date, kind: c.agent, id: c.id8 }], contextFor(c), { id: `GS-DEMO-${c.id8}` });
  res.type('html').send(renderCaseFileHtml(cf));
});

// ---- Real Bolna calls + fact sheet
app.get('/api/bolna/calls', async (_req, res) => {
  const facts = loadFacts();
  const out = [];
  for (const c of loadCalls()) {
    const fact = facts.calls[c.id8] ?? { status: 'unverified', source: 'none', facts: {}, risks: [] };
    const scored = c.turns.length ? await scoreCall(c, fact) : undefined;
    out.push({ ...c, fact, audioAvailable: existsSync(join(root, 'eval', c.audio)), scored });
  }
  res.json({ fields: facts._fields, calls: out });
});

app.post('/api/bolna/facts/:id8', (req, res) => {
  const facts = loadFacts();
  const id8 = String(req.params.id8);
  if (!/^[0-9a-f]{8}$/.test(id8)) return res.status(400).json({ error: 'bad id' });
  const { status, facts: f, risks, notes } = req.body ?? {};
  if (!['verified', 'unverified', 'skip'].includes(status)) return res.status(400).json({ error: 'bad status' });
  facts.calls[id8] = { status, source: status === 'verified' ? 'you' : (facts.calls[id8]?.source ?? 'you'), facts: f ?? {}, risks: Array.isArray(risks) ? risks : [], notes: String(notes ?? '') };
  saveFacts(facts);
  res.json({ ok: true });
});

app.get('/api/results/bolna', (_req, res) => {
  const p = join(EVAL_DIR, 'results.bolna.json');
  if (!existsSync(p)) return res.status(404).json({ error: 'Run: npm run eval:bolna' });
  res.json(JSON.parse(readFileSync(p, 'utf8')));
});

// Vercel runs the exported app as a function; locally we listen on a port.
if (process.env.VERCEL && !process.env.STORE) process.env.STORE = 'memory'; // read-only disk on Vercel
export default app;
if (!process.env.VERCEL) {
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => console.log(`Gulf Saathi harness on http://localhost:${port}  (OpenAI key: ${hasKey() ? 'set' : 'NOT set — text mode only'})`));
}
