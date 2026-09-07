/** Preserve the existing plain-text client protocol without hiding stream failures. */
export interface TextEvent {
  type: string;
  text?: string;
  finishReason?: string;
}

export function researchTextResponse(events: AsyncIterable<TextEvent>, abort: () => void): Response {
  const iterator = events[Symbol.asyncIterator]();
  const encoder = new TextEncoder();
  let finished = false;
  let hasText = false;
  let closed = false;
  async function dispose() {
    abort();
    try { await iterator.return?.(); } catch { /* Preserve the original sanitized error. */ }
  }
  return new Response(new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        while (!closed) {
          const { value, done } = await iterator.next();
          if (done) {
            if (!finished || !hasText) throw new Error('incomplete');
            closed = true;
            controller.close();
            return;
          }
          if (value.type === 'error' || value.type === 'abort') throw new Error('failed');
          if (value.type === 'finish') {
            if (value.finishReason !== 'stop') throw new Error('incomplete');
            finished = true;
          }
          if (value.type === 'text-delta' && typeof value.text === 'string') {
            if (value.text.trim()) hasText = true;
            controller.enqueue(encoder.encode(value.text));
            return;
          }
        }
      } catch {
        if (!closed) {
          closed = true;
          controller.error(new Error('Research response did not finish. Please retry.'));
        }
        await dispose();
      }
    },
    async cancel() {
      closed = true;
      await dispose();
    },
  }), { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
}
