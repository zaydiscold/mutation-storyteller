import { test } from 'node:test';
import assert from 'node:assert/strict';
import { providerHeaders, readProviderOptions, DEFAULT_SETTINGS, providerError } from '../lib/provider-options.ts';
// The stream uses a TypeScript extension-free import, compiled by the test runner below.

test('hosted settings never transmit a client key or model override', () => {
  assert.deepEqual(providerHeaders({ ...DEFAULT_SETTINGS, apiKey: 'secret', model: 'expensive/model' }), { 'x-rosie-provider': 'server', 'x-rosie-depth': 'detailed' });
});
test('BYOK has separate request-scoped credentials and an explicit free default', () => {
  const headers = providerHeaders({ provider: 'openrouter', apiKey: ' test-key ', model: '', depth: 'overview' });
  assert.equal(headers['x-rosie-model'], 'openrouter/free');
  assert.equal(headers['x-rosie-key'], 'test-key');
  assert.equal(readProviderOptions(new Headers(headers)).provider, 'openrouter');
});
test('provider validation rejects unknown providers, invalid models, and missing keys', () => {
  for (const headers of [{ 'x-rosie-provider': 'evil' }, { 'x-rosie-provider': 'google' }, { 'x-rosie-model': 'https://evil?key=x' }, { 'x-rosie-depth': 'unknown' }]) {
    assert.throws(() => readProviderOptions(new Headers(headers)));
  }
});
test('provider errors are actionable and never echo secrets', () => {
  for (const statusCode of [400, 401, 402, 403, 404, 429, 500]) {
    const message = providerError({ statusCode, message: 'sk-secret', requestBodyValues: { key: 'sk-secret' } });
    assert.ok(!message.includes('sk-secret'));
    assert.ok(message.length > 20);
  }
  assert.match(providerError({ statusCode: 429 }), /quota or rate limit/);
});

const { researchEventResponse } = await import('../lib/research-stream.ts');
async function* events(values) { yield* values; }
const metadata = { provider: 'openrouter', model: 'openrouter/free', depth: 'detailed' };
test('structured stream keeps source output and actual model metadata independent of prose', async () => {
  const response = researchEventResponse(events([
    { type: 'tool-call', toolCallId: '1', toolName: 'searchUniprot', input: { geneName: 'TREM2' } },
    { type: 'tool-result', toolCallId: '1', toolName: 'searchUniprot', output: { accession: 'Q9NZC2' } },
    { type: 'response-metadata', modelId: 'resolved/model' },
    { type: 'text-delta', text: 'Evidence review.' },
    { type: 'finish', finishReason: 'stop' },
  ]), () => {}, metadata);
  const records = (await response.text()).trim().split('\n').map(JSON.parse);
  assert.deepEqual(records.map(x => x.type), ['metadata', 'source-start', 'source-result', 'resolved-model', 'text', 'done']);
  assert.equal(records[2].output.accession, 'Q9NZC2');
  assert.equal(records[3].model, 'resolved/model');
});
test('truncated and failed structured streams never emit completion or secrets', async () => {
  for (const values of [[], [{ type: 'text-delta', text: 'partial' }], [{ type: 'error', error: { statusCode: 401, message: 'secret-key' } }], [{ type: 'text-delta', text: 'partial' }, { type: 'finish', finishReason: 'length' }]]) {
    let aborted = false;
    const output = await researchEventResponse(events(values), () => { aborted = true; }, metadata).text();
    assert.ok(output.includes('"type":"error"'));
    assert.ok(!output.includes('"type":"done"'));
    assert.ok(!output.includes('secret-key'));
    assert.ok(aborted);
  }
});
test('canceling structured research cancels its upstream source', async () => {
  let aborted = false;
  const reader = researchEventResponse(events([]), () => { aborted = true; }, metadata).body.getReader();
  await reader.read(); await reader.cancel(); assert.ok(aborted);
});

const { clinicalRecord } = await import('../lib/clinvar-record.ts');
test('current ClinVar germline classifications and review status are retained without conflating somatic fields', () => {
  const record = clinicalRecord('123', { title: 'Test record', germline_classification: { description: 'Uncertain significance', review_status: 'criteria provided', last_evaluated: '2026-01-01' }, oncogenicity_classification: { description: 'Separate somatic field' } });
  assert.equal(record.clinicalSignificance, 'Uncertain significance');
  assert.equal(record.reviewStatus, 'criteria provided');
  assert.equal(record.oncogenicity, 'Separate somatic field');
  assert.equal(clinicalRecord('123', { clinical_significance: { description: 'Legacy classification' } }).clinicalSignificance, 'Legacy classification');
});
