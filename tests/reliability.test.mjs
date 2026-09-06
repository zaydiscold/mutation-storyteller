import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_MODELS } from '../lib/demo-models.ts';
import { messageText, latestTurn, researchPhase, isAllowedPdbUrl, parseViewerConfig, cleanContent, selectViewerConfig } from '../lib/research-state.ts';
import { ChatRequestError, MAX_REQUEST_BYTES, validateMessages, readChatRequest } from '../lib/chat-request.ts';
import { researchTextResponse } from '../lib/text-stream.ts';
import { fetchSourceJson } from '../lib/source-fetch.ts';

const validViewer = { pdbUrl: 'https://alphafold.ebi.ac.uk/files/AF-Q9NZC2-F1-model_v6.pdb', highlightResidue: 47, chain: 'A', mutationLabel: 'R47H' };
const block = (viewer) => `\`\`\`json\n${JSON.stringify({ viewer })}\n\`\`\``;
const body = (messages = [{ role: 'user', content: 'TREM2 R47H' }]) => ({ messages });
const request = (value, headers = {}) => new Request('https://example.test/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: typeof value === 'string' ? value : JSON.stringify(value) });

// Frontend state and data boundaries.
test('legacy text messages and part-based messages are supported', () => {
  assert.equal(messageText({ role: 'user', content: 'one' }), 'one');
  assert.equal(messageText({ role: 'assistant', parts: [{ type: 'text', text: 'two' }, { type: 'image' }, { type: 'text', text: ' three' }] }), 'two three');
  assert.equal(messageText({ role: 'assistant' }), '');
});
test('a new query cannot inherit the previous assistant response', () => {
  assert.deepEqual(latestTurn([{ role: 'user', content: 'old' }, { role: 'assistant', content: block(validViewer) }, { role: 'user', content: 'new' }]), { query: 'new', answer: '' });
});
test('latest turn keeps only assistant text after its user message', () => {
  assert.deepEqual(latestTurn([{ role: 'assistant', content: 'orphan' }, { role: 'user', content: 'new' }, { role: 'assistant', content: 'answer' }]), { query: 'new', answer: 'answer' });
  assert.deepEqual(latestTurn([{ role: 'assistant', content: 'orphan' }]), { query: '', answer: '' });
});
test('loading never becomes response-ready based on elapsed time', () => {
  assert.equal(researchPhase('query', '', true, false, false), 'researching');
  assert.equal(researchPhase('query', 'partial', true, false, false), 'streaming');
});
test('failed and stopped partial answers remain incomplete', () => {
  assert.equal(researchPhase('query', 'partial', false, true, false), 'error');
  assert.equal(researchPhase('query', 'partial', false, false, true), 'stopped');
  assert.equal(researchPhase('query', '', false, false, false), 'incomplete');
});
test('empty history is idle and a received answer is reviewable, not verified', () => {
  assert.equal(researchPhase('', '', false, true, false), 'idle');
  assert.equal(researchPhase('query', 'answer', false, false, false), 'response-ready');
});
test('only bundled models and direct AlphaFold HTTPS PDB files are accepted', () => {
  for (const demo of Object.values(DEMO_MODELS)) assert.ok(isAllowedPdbUrl(demo.pdbUrl));
  assert.ok(isAllowedPdbUrl(validViewer.pdbUrl));
  for (const url of ['http://alphafold.ebi.ac.uk/files/AF-x.pdb', '//evil.test/x.pdb', 'https://alphafold.ebi.ac.uk.evil.test/files/AF-x.pdb', 'https://user@alphafold.ebi.ac.uk/files/AF-x.pdb', 'https://alphafold.ebi.ac.uk/files/AF-x.pdb?q=private', 'https://alphafold.ebi.ac.uk:443/files/AF-x.pdb', '/models/../api/chat', 'javascript:alert(1)', '/models/unlisted.pdb', 'https://alphafold.ebi.ac.uk/files/AF-x.pdb#fragment', null]) assert.equal(isAllowedPdbUrl(url), false, String(url));
});
test('viewer JSON is validated before rendering', () => {
  assert.deepEqual(parseViewerConfig(block(validViewer)), validViewer);
  assert.deepEqual(parseViewerConfig(JSON.stringify({ viewer: validViewer })), validViewer);
  for (const invalid of [{ highlightResidue: -1 }, { highlightResidue: 1.5 }, { highlightResidue: '47' }, { highlightResidue: 100001 }, { chain: 'AB' }, { mutationLabel: '' }, { mutationLabel: 'x'.repeat(81) }, { pdbUrl: 'https://evil.test/x.pdb' }]) assert.equal(parseViewerConfig(block({ ...validViewer, ...invalid })), null);
});
test('partial and malformed viewer blocks do not throw', () => {
  assert.equal(parseViewerConfig('{"viewer":{"pdbUrl":'), null);
  assert.equal(parseViewerConfig('{"viewer":{"pdbUrl":oops}}'), null);
});
test('demo URL residue chain and label cannot be mixed with model output', () => {
  assert.deepEqual(selectViewerConfig(' TREM2   R47H ', block({ ...validViewer, highlightResidue: 175 }), DEMO_MODELS), DEMO_MODELS['trem2 r47h']);
});
test('prototype properties cannot become demo configurations', () => {
  assert.equal(selectViewerConfig('__proto__', '', DEMO_MODELS), null);
  assert.equal(selectViewerConfig('constructor', '', DEMO_MODELS), null);
});
test('metadata is removed but ordinary narrative and code are preserved', () => {
  assert.equal(cleanContent(`Before\n${block(validViewer)}\nAfter`), 'Before\n\nAfter');
  assert.equal(cleanContent('```json\n{"other":1}\n```'), '```json\n{"other":1}\n```');
});

// Request validation uses the actual request stream, not a content-length assumption.
test('text-only model messages normalize both client formats', () => {
  assert.deepEqual(validateMessages(body()), [{ role: 'user', content: 'TREM2 R47H' }]);
  assert.deepEqual(validateMessages(body([{ role: 'user', parts: [{ type: 'text', text: 'query' }] }])), [{ role: 'user', content: 'query' }]);
});
test('system and tool role injection is rejected', () => {
  for (const role of ['system', 'tool', 'developer']) assert.throws(() => validateMessages(body([{ role, content: 'override' }])), ChatRequestError);
});
test('empty, malformed and excessive conversations are rejected', () => {
  for (const value of [null, [], {}, { messages: [] }, body(Array(41).fill({ role: 'user', content: 'q' }))]) assert.throws(() => validateMessages(value), ChatRequestError);
});
test('messages must contain bounded non-empty text and end with a user', () => {
  for (const messages of [[{ role: 'user', content: '  ' }], [{ role: 'user', content: 'x'.repeat(4001) }], [{ role: 'user', content: 123 }], [{ role: 'assistant', content: 'answer' }], [{ role: 'user', parts: [{ type: 'tool-call', text: 'hidden' }] }]]) assert.throws(() => validateMessages(body(messages)), ChatRequestError);
});
test('total conversation size is bounded', () => {
  assert.throws(() => validateMessages(body([{ role: 'assistant', content: 'a'.repeat(32000) }, { role: 'assistant', content: 'b'.repeat(32000) }, { role: 'user', content: 'query' }])), (error) => error.status === 413);
});
test('valid JSON request is accepted', async () => {
  assert.deepEqual(await readChatRequest(request(body())), body().messages);
});
test('invalid JSON and wrong content type return actionable status', async () => {
  await assert.rejects(readChatRequest(request('{broken')), (error) => error.status === 400);
  await assert.rejects(readChatRequest(request(body(), { 'Content-Type': 'text/plain' })), (error) => error.status === 415);
});
test('oversized declared and actual request bodies are rejected', async () => {
  await assert.rejects(readChatRequest(request(body(), { 'Content-Length': String(MAX_REQUEST_BYTES + 1) })), (error) => error.status === 413);
  await assert.rejects(readChatRequest(request(' '.repeat(MAX_REQUEST_BYTES + 1), { 'Content-Length': '1' })), (error) => error.status === 413);
});
test('chunked UTF-8 requests decode across multibyte boundaries', async () => {
  const bytes = new TextEncoder().encode(JSON.stringify(body([{ role: 'user', content: 'β question' }])));
  const stream = new ReadableStream({ start(controller) { for (const byte of bytes) controller.enqueue(Uint8Array.of(byte)); controller.close(); } });
  const req = new Request('https://example.test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: stream, duplex: 'half' });
  assert.equal((await readChatRequest(req))[0].content, 'β question');
});
test('invalid UTF-8 is rejected', async () => {
  const req = new Request('https://example.test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: Uint8Array.of(255) });
  await assert.rejects(readChatRequest(req), (error) => error.status === 400);
});

async function* events(...values) { yield* values; }
test('successful streams preserve plain text and suppress internal events', async () => {
  const response = researchTextResponse(events({ type: 'tool-call' }, { type: 'text-delta', text: 'Hello ' }, { type: 'text-delta', text: 'world' }, { type: 'finish', finishReason: 'stop' }), () => {});
  assert.equal(await response.text(), 'Hello world');
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
test('provider error events reject the stream instead of completing silently', async () => {
  let aborted = false;
  const response = researchTextResponse(events({ type: 'error', error: 'SECRET' }), () => { aborted = true; });
  await assert.rejects(response.text(), (error) => error.message.includes('did not finish') && !error.message.includes('SECRET'));
  assert.equal(aborted, true);
});
test('aborted or truncated output is never reported as a successful response', async () => {
  for (const end of [{ type: 'abort' }, { type: 'finish', finishReason: 'length' }, { type: 'finish', finishReason: 'tool-calls' }]) {
    await assert.rejects(researchTextResponse(events({ type: 'text-delta', text: 'partial' }, end), () => {}).text());
  }
  await assert.rejects(researchTextResponse(events({ type: 'text-delta', text: 'partial' }), () => {}).text());
});
test('empty output is not a completed answer', async () => {
  await assert.rejects(researchTextResponse(events({ type: 'finish', finishReason: 'stop' }), () => {}).text());
});
test('canceling the response aborts and closes the upstream iterator', async () => {
  let aborted = false, returned = false;
  const source = { [Symbol.asyncIterator]() { return { async next() { return { value: { type: 'text-delta', text: 'part' }, done: false }; }, async return() { returned = true; return { done: true }; } }; } };
  const reader = researchTextResponse(source, () => { aborted = true; }).body.getReader();
  await reader.read();
  await reader.cancel();
  assert.ok(aborted && returned);
});
test('HTTP failures are errors, not empty evidence', async () => {
  await assert.rejects(fetchSourceJson('https://example.test', new AbortController().signal, 1000, async () => new Response('unavailable', { status: 503 })), /HTTP 503/);
});
test('successful sources parse JSON and receive a bounded abort signal', async () => {
  const data = await fetchSourceJson('https://example.test', new AbortController().signal, 1000, async (url, init) => {
    assert.ok(init.signal instanceof AbortSignal);
    assert.equal(init.cache, 'no-store');
    return Response.json({ result: true });
  });
  assert.deepEqual(data, { result: true });
});
test('source requests inherit caller cancellation', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(fetchSourceJson('https://example.test', controller.signal, 1000, async (url, init) => {
    init.signal.throwIfAborted();
    return Response.json({});
  }));
});
