import { providerError } from './provider-options.ts';

interface ResearchEvent {
  type: string;
  text?: string;
  toolCallId?: string;
  toolName?: string;
  input?: unknown;
  output?: unknown;
  error?: unknown;
  finishReason?: string;
  modelId?: string;
}

/** NDJSON carries actual tool results independently of generated prose. */
export function researchEventResponse(events: AsyncIterable<ResearchEvent>, abort: () => void, metadata: { provider: string; model: string; depth: string }) {
  const iterator = events[Symbol.asyncIterator]();
  const encoder = new TextEncoder();
  let finished = false;
  let hasText = false;
  return new Response(new ReadableStream({
    start(controller) { controller.enqueue(encoder.encode(JSON.stringify({ type: 'metadata', ...metadata }) + '\n')); },
    async pull(controller) {
      try {
        while (true) {
          const { value, done } = await iterator.next();
          if (done) {
            if (!finished || !hasText) throw new Error('incomplete');
            controller.enqueue(encoder.encode('{"type":"done"}\n'));
            controller.close();
            return;
          }
          let event: unknown;
          if (value.type === 'error') throw value.error;
          if (value.type === 'abort') throw new Error('aborted');
          if (value.type === 'finish') {
            if (value.finishReason !== 'stop') throw new Error('incomplete');
            finished = true;
          }
          if (value.type === 'text-delta' && value.text) { hasText ||= Boolean(value.text.trim()); event = { type: 'text', text: value.text }; }
          if (value.type === 'tool-call') event = { type: 'source-start', id: value.toolCallId, name: value.toolName, input: value.input };
          if (value.type === 'tool-result') event = { type: 'source-result', id: value.toolCallId, name: value.toolName, output: value.output };
          if (value.type === 'tool-error') event = { type: 'source-result', id: value.toolCallId, name: value.toolName, output: { error: 'Source lookup failed.' } };
          if (value.type === 'response-metadata' && value.modelId) event = { type: 'resolved-model', model: value.modelId };
          if (event) { controller.enqueue(encoder.encode(JSON.stringify(event) + '\n')); return; }
        }
      } catch (error) {
        controller.enqueue(encoder.encode(JSON.stringify({ type: 'error', message: providerError(error) }) + '\n'));
        controller.close();
        abort();
        await iterator.return?.();
      }
    },
    async cancel() { abort(); await iterator.return?.(); },
  }), { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
