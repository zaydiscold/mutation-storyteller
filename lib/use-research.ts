'use client';
import { useRef, useState } from 'react';
import { providerHeaders, type ProviderSettings } from './provider-options';

export interface Evidence { id: string; name: string; status: 'loading' | 'ready' | 'error'; input?: unknown; output?: Record<string, unknown> }
export interface ResearchMessage { id: string; role: 'user' | 'assistant'; content: string; evidence?: Evidence[]; provider?: string; model?: string; depth?: string; createdAt?: string; complete?: boolean }

export function useResearch(settings: ProviderSettings) {
  const [messages, setMessages] = useState<ResearchMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);

  async function run(history: ResearchMessage[]) {
    if (controller.current) return;
    const abort = new AbortController();
    controller.current = abort;
    const runId = ++generation.current;
    const answer: ResearchMessage = { id: crypto.randomUUID(), role: 'assistant', content: '', evidence: [], createdAt: new Date().toISOString(), complete: false };
    const update = () => { if (runId === generation.current) setMessages([...history, { ...answer, evidence: [...(answer.evidence || [])] }]); };
    setError(null); setLoading(true); update();
    try {
      const response = await fetch('/api/chat', {
        method: 'POST', signal: abort.signal,
        headers: { 'Content-Type': 'application/json', 'x-rosie-stream': 'events', ...providerHeaders(settings) },
        body: JSON.stringify({ messages: history.filter(m => m.content.trim()).map(({ role, content }) => ({ role, content })) }),
      });
      if (!response.ok) throw new Error((await response.text()).slice(0, 500));
      if (!response.body) throw new Error('No response received.');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let doneEvent = false;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n'); buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.trim()) continue;
            const event = JSON.parse(line);
            if (event.type === 'error') throw new Error(event.message);
            if (event.type === 'metadata') { answer.provider = event.provider; answer.model = event.model; answer.depth = event.depth; }
            if (event.type === 'resolved-model') answer.model = event.model;
            if (event.type === 'text') answer.content += event.text;
            if (event.type === 'source-start') answer.evidence!.push({ id: event.id, name: event.name, input: event.input, status: 'loading' });
            if (event.type === 'source-result') {
              const record = answer.evidence!.find(e => e.id === event.id);
              if (record) { record.output = event.output; record.status = event.output?.error ? 'error' : 'ready'; }
            }
            if (event.type === 'done') { doneEvent = true; answer.complete = true; }
          }
          update();
        }
      } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
      if (!doneEvent) throw new Error('The response was interrupted. The partial report is incomplete.');
    } catch (failure) {
      if (!abort.signal.aborted && runId === generation.current) setError(failure instanceof Error ? failure.message : 'Research failed. Please retry.');
    } finally {
      answer.evidence = answer.evidence?.map(e => e.status === 'loading' ? { ...e, status: 'error', output: { error: 'Lookup did not finish.' } } : e);
      update();
      if (runId === generation.current) { controller.current = null; setLoading(false); }
    }
  }
  function append(message: { role: 'user'; content: string }) { return run([...messages, { ...message, id: crypto.randomUUID() }]); }
  function reload() {
    const index = messages.findLastIndex(m => m.role === 'user');
    if (index >= 0) return run(messages.slice(0, index + 1));
  }
  return {
    messages, input, setInput, isLoading, error, append, reload,
    handleInputChange: (event: React.ChangeEvent<HTMLInputElement>) => setInput(event.target.value),
    handleSubmit: (event: React.FormEvent) => { event.preventDefault(); if (input.trim() && !controller.current) { void append({ role: 'user', content: input.trim() }); setInput(''); } },
    stop: () => controller.current?.abort(),
    setMessages: (next: ResearchMessage[]) => { if (!controller.current) { setMessages(next); setError(null); } },
  };
}
