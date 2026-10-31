import test from 'node:test';
import assert from 'node:assert/strict';
import { explainCode } from '../src/ai.js';

function setEnv(t, name, value) {
  const previous = process.env[name];
  process.env[name] = value;
  t.after(() => {
    if (previous === undefined) delete process.env[name];
    else process.env[name] = previous;
  });
}

const input = { path: 'index.js', content: 'export const value = 1;', question: 'Why?', evidence: [{ label: 'Initial commit' }] };

test('Groq uses server credentials and validates evidence references', async (t) => {
  setEnv(t, 'GROQ_API_KEY', 'test-key');
  setEnv(t, 'GROQ_MODEL', 'test-model');
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
    assert.equal(options.headers.Authorization, 'Bearer test-key');
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'test-model');
    assert.equal(body.response_format.type, 'json_object');
    return Response.json({ choices: [{ message: { content: JSON.stringify({ title: 'Reason', explanation: 'Evidence based.', confidence: 120, insights: ['Check tests'], sourceNumbers: [1, 99, 1.5] }) } }] });
  });
  const result = await explainCode(input);
  assert.equal(result.model, 'test-model');
  assert.equal(result.confidence, 100);
  assert.deepEqual(result.evidence, input.evidence);
});

test('Groq failures return fallback signal without trying local Ollama', async (t) => {
  setEnv(t, 'GROQ_API_KEY', 'test-key');
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 429 }));
  assert.equal(await explainCode(input), null);
  assert.equal(fetch.mock.callCount(), 1);
});

test('Malformed AI output returns fallback signal', async (t) => {
  setEnv(t, 'GROQ_API_KEY', 'test-key');
  t.mock.method(globalThis, 'fetch', async () => Response.json({ choices: [{ message: { content: 'invalid' } }] }));
  assert.equal(await explainCode(input), null);
});

test('Vercel without a configured provider skips local Ollama', async (t) => {
  setEnv(t, 'GROQ_API_KEY', '');
  setEnv(t, 'OLLAMA_URL', '');
  setEnv(t, 'VERCEL', '1');
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Must not fetch'); });
  assert.equal(await explainCode(input), null);
  assert.equal(fetch.mock.callCount(), 0);
});
