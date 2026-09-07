'use client';

import { useResearch } from '@/lib/use-research';
import { ModelSettings } from '@/components/ModelSettings';
import { EvidencePanel } from '@/components/EvidencePanel';
import { DEFAULT_SETTINGS } from '@/lib/provider-options';
import Markdown from 'react-markdown';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { ProteinViewer } from '@/components/ProteinViewer';
import { DEMO_KEYS, DEMO_MODELS } from '@/lib/demo-models';
import { cleanContent, latestTurn, messageText, researchPhase, selectViewerConfig } from '@/lib/research-state';

const EXAMPLES = [
  { label: 'TREM2 R47H', subtitle: "Alzheimer's" },
  { label: 'TP53 R175H', subtitle: 'Cancer' },
  { label: 'BRCA1 C61G', subtitle: 'Breast Cancer' },
  { label: 'CFTR F508del', subtitle: 'Cystic Fibrosis' },
];

const PHASE_LABELS = {
  idle: 'Enter a mutation to begin.',
  researching: 'Request sent. Waiting for research output.',
  streaming: 'Receiving the research response.',
  'response-ready': 'Response received. Review its sources and limitations.',
  stopped: 'Stopped. Any partial response is incomplete.',
  error: 'Research did not finish. Retry the request.',
  incomplete: 'No response was received. Retry the request.',
};

export default function Home() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [preview, setPreview] = useState<string | null>(null);
  const { messages, input, handleInputChange, handleSubmit, isLoading, append, error, stop, reload, setMessages, setInput } = useResearch(settings);
  const [secretMode, setSecretMode] = useState(false);
  const [secretIndex, setSecretIndex] = useState(0);
  const [stopped, setStopped] = useState(false);

  useEffect(() => {
    let buffer = '';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, [contenteditable]')) return;
      if (event.key.length !== 1) { buffer = ''; return; }
      buffer = (buffer + event.key.toLowerCase()).slice(-5);
      if (buffer === 'radio') { setSecretMode((value) => !value); buffer = ''; }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!secretMode) return;
    const timer = window.setInterval(() => setSecretIndex((index) => (index + 1) % DEMO_KEYS.length), 5500);
    return () => window.clearInterval(timer);
  }, [secretMode]);

  const turn = useMemo(() => latestTurn(messages), [messages]);
  const phase = researchPhase(turn.query, turn.answer, isLoading, Boolean(error), stopped);
  const viewerConfig = useMemo(() => secretMode
    ? DEMO_MODELS[DEMO_KEYS[secretIndex]]
    : preview ? DEMO_MODELS[preview] : selectViewerConfig(turn.query, turn.answer, DEMO_MODELS), [turn.query, turn.answer, secretMode, secretIndex, preview]);
  const retryable = !isLoading && ['error', 'stopped', 'incomplete'].includes(phase);
  const steps = [
    { title: 'Request submitted', subtitle: 'Your current question', completed: Boolean(turn.query), active: false },
    { title: 'Research response', subtitle: 'Waiting or receiving text', completed: phase === 'response-ready', active: isLoading },
    { title: 'Review sources', subtitle: 'Response is not clinical validation', completed: false, active: phase === 'response-ready' },
  ];

  const handleExample = (query: string) => {
    if (isLoading) return;
    setStopped(false); setPreview(null);
    void append({ role: 'user', content: query });
  };

  return (
    <main>
      <div className="archive-container">
        <div className="animate-entrance animate-delay-1" style={{ textAlign: 'center', marginBottom: 32 }}>
          <Image src="/icon.png" alt="Mutation Storyteller logo" width={80} height={80} style={{ marginBottom: 16, display: 'inline-block' }} />
          <h1 style={{ marginBottom: 8 }}>mutation storyteller<span className="hero-cursor" /></h1>
          <p style={{ color: 'var(--muted)', fontSize: '1.1em', margin: 0 }}>Type a mutation. See the protein. Understand the science.</p>
          <p style={{ color: 'var(--faded)', fontSize: '0.85em', marginTop: 6, maxWidth: 860, marginInline: 'auto' }}>
            Rosie connects human genetic variants with protein structures and traceable research evidence.
          </p>
          <p style={{ color: 'var(--faded)', fontSize: '0.8em', marginTop: 6 }}>UniProt · AlphaFold · PubMed · ClinVar</p>
          {secretMode && <p style={{ color: 'var(--accent)', fontSize: '0.75em', marginTop: 8, letterSpacing: '0.25em', fontWeight: 'bold' }}>Radio Mode Active: demo structures, not live research</p>}
        </div>

        <ModelSettings value={settings} onChange={setSettings} disabled={isLoading} />
        <section className="animate-entrance animate-delay-2" aria-label="Research status" style={{ marginBottom: 20, border: '1px solid var(--ink)', background: 'var(--card)', padding: 14 }}>
          <p className="module-header">RESEARCH STATUS</p>
          <p role="status" aria-live="polite">{PHASE_LABELS[phase]}</p>
          <div className="timeline-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
            {steps.map((step) => (
              <div key={step.title} className={`timeline-step${step.completed ? ' completed' : ''}${step.active ? ' active' : ''}`}>
                <div className="timeline-bar" />
                <p className="timeline-title">{step.title}</p>
                <p className="timeline-subtitle">{step.subtitle}</p>
              </div>
            ))}
          </div>
        </section>
        <style>{`
          @media (min-width: 900px) { .timeline-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; } }
          @media (min-width: 1024px) { .main-grid { grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr) !important; } }
        `}</style>

        <div className="main-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>
          <div className="animate-entrance animate-delay-2" style={{ display: 'flex', flexDirection: 'column' }}>
            {messages.length === 0 && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ color: 'var(--muted)', fontSize: '0.85em', marginBottom: 10 }}>Try one of these:</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {EXAMPLES.map((example) => (
                    <button type="button" key={example.label} disabled={isLoading} onClick={() => handleExample(example.label)} className="example-btn">
                      <span style={{ fontWeight: 'bold' }}>{example.label}</span><span className="example-subtitle">{example.subtitle}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div role="log" aria-label="Research conversation" style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16, minWidth: 0 }}>
              {messages.map((message) => (
                <div key={message.id} style={message.role === 'user' ? { textAlign: 'right' } : {}}>
                  <div className={message.role === 'user' ? 'message-user' : 'message-assistant'}>
                    {message.role === 'user' ? messageText(message) : <><p className="report-meta">{message.provider} / {message.model} · {message.depth} · {message.complete ? 'Report complete' : 'Incomplete report'}</p><Markdown components={{ img: () => null }}>{cleanContent(messageText(message))}</Markdown><EvidencePanel evidence={message.evidence || []} /></>}
                  </div>
                </div>
              ))}
              {isLoading && <div className="message-loading">Researching...</div>}
              {error && turn.query && <div role="alert" className="message-error">{error}</div>}
            </div>
            <form onSubmit={(event) => {
              if (isLoading || !input.trim()) { event.preventDefault(); return; }
              setStopped(false); setPreview(null);
              handleSubmit(event);
            }} style={{ display: 'flex', gap: 8 }}>
              <input value={input} onChange={handleInputChange} aria-label="Mutation or follow-up question" maxLength={4000} required placeholder="Enter a mutation (e.g., TREM2 R47H)" className="archive-input" />
              <button type="submit" disabled={isLoading || !input.trim()} className="archive-submit">Go</button>
            </form>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {isLoading && <button type="button" className="example-btn" onClick={() => { setStopped(true); stop(); }}>Stop research</button>}
              {retryable && <button type="button" className="example-btn" onClick={() => { setStopped(false); void reload(); }}>Retry last question</button>}
              {messages.length > 0 && <button type="button" className="example-btn" disabled={isLoading} onClick={() => { setMessages([]); setInput(''); setStopped(false); setSecretMode(false); setPreview(null); }}>New conversation</button>}
            </div>
          </div>
          <div className="animate-entrance animate-delay-3 structure-panel">
            <h2 className="module-header">STRUCTURE EXPLORER</h2>
            <label className="preview-label">Explore a bundled reference (no API key needed)
              <select aria-label="Reference structure" value={preview || ''} onChange={e => setPreview(e.target.value || null)}>
                <option value="">Current research</option>
                {Object.entries(DEMO_MODELS).map(([id, config]) => <option key={id} value={id}>{config.mutationLabel}</option>)}
              </select>
            </label>
            {preview && <p className="small-note">Bundled reference preview. This selection does not generate a research report.</p>}
            {messages.some(m => m.role === 'assistant' && m.content) && <button type="button" className="example-btn export-btn" disabled={isLoading} onClick={() => {
              const report = messages.map(m => m.role === 'user' ? `# ${m.content}` : `Provider: ${m.provider} / ${m.model}\nDepth: ${m.depth}\nRetrieved: ${m.createdAt}\nStatus: ${m.complete ? 'Complete' : 'INCOMPLETE'}\n\n${cleanContent(m.content)}\n\n## Retrieved source records\n\n${JSON.stringify(m.evidence, null, 2)}`).join('\n\n');
              const url = URL.createObjectURL(new Blob([report], { type: 'text/markdown' }));
              const link = document.createElement('a'); link.href = url; link.download = 'rosie-research.md'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}>Download research report</button>}
            <ProteinViewer config={viewerConfig} secretMode={secretMode} />
            {viewerConfig && <p className="viewer-source">
              {viewerConfig.pdbUrl.startsWith('/models/') ? 'Bundled AlphaFold reference prediction' : 'Retrieved AlphaFold reference prediction'}. Requested residue: {viewerConfig.highlightResidue}. This is not a simulated mutant structure or evidence of pathogenicity.
            </p>}
          </div>
        </div>
        <div className="archive-footer">Educational research only, not medical advice. Sources: UniProt, AlphaFold, PubMed, ClinVar.</div>
      </div>
    </main>
  );
}
