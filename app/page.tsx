'use client';

import { useChat } from '@ai-sdk/react';
import { useEffect, useMemo, useState } from 'react';
import { ProteinViewer } from '@/components/ProteinViewer';
import { DEMO_KEYS, DEMO_MODELS, type ViewerConfig, normalizeMutationQuery } from '@/lib/demo-models';

const EXAMPLES = [
  { label: 'TREM2 R47H', subtitle: "Alzheimer's" },
  { label: 'TP53 R175H', subtitle: 'Cancer' },
  { label: 'BRCA1 C61G', subtitle: 'Breast Cancer' },
  { label: 'CFTR F508del', subtitle: 'Cystic Fibrosis' },
];

const TIMELINE_STOPS = [
  { id: 'submitted', title: 'Mutation Submitted', subtitle: 'Input parsed and normalized' },
  { id: 'uniprot', title: 'UniProt Lookup', subtitle: 'Protein identity and function context' },
  { id: 'alphafold', title: 'AlphaFold Structure', subtitle: '3D model selected and loaded' },
  { id: 'pubmed', title: 'PubMed Scan', subtitle: 'Recent literature attached' },
  { id: 'clinvar', title: 'ClinVar Evidence', subtitle: 'Clinical significance reviewed' },
  { id: 'synthesis', title: 'Story Synthesis', subtitle: 'Narrative with citations generated' },
];

function getTextFromParts(parts: Array<{ type: string; text?: string }>): string {
  return parts
    .filter((p) => p.type === 'text' && p.text)
    .map((p) => p.text!)
    .join('');
}

function extractViewerConfig(content: string): ViewerConfig | null {
  const match = content.match(/\{"viewer":\s*\{[^}]+\}\}/);
  if (match) {
    try { return JSON.parse(match[0]).viewer; } catch { return null; }
  }
  return null;
}

function cleanContent(content: string): string {
  return content.replace(/```json\s*\{"viewer":[^`]*```/g, '').trim();
}

export default function Home() {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    append,
    error,
  } = useChat({ streamProtocol: 'text' });
  const [secretMode, setSecretMode] = useState(false);
  const [secretIndex, setSecretIndex] = useState(0);
  const [loadingSeconds, setLoadingSeconds] = useState(0);

  useEffect(() => {
    let buffer = '';
    const togglePhrase = 'radio';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.length !== 1) return;
      buffer = (buffer + event.key.toLowerCase()).slice(-togglePhrase.length);
      if (buffer === togglePhrase) {
        setSecretMode((current) => !current);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!secretMode) return;
    const timer = window.setInterval(() => {
      setSecretIndex((index) => (index + 1) % DEMO_KEYS.length);
    }, 5500);
    return () => window.clearInterval(timer);
  }, [secretMode]);

  useEffect(() => {
    if (!isLoading) return;

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setLoadingSeconds((Date.now() - startedAt) / 1000);
    }, 300);

    return () => window.clearInterval(timer);
  }, [isLoading]);

  const activeUserMutation = useMemo(() => {
    const lastUser = [...messages].reverse().find((message) => message.role === 'user');
    if (!lastUser) return null;
    const userText = getTextFromParts(lastUser.parts as Array<{ type: string; text?: string }>);
    if (!userText) return null;
    return normalizeMutationQuery(userText);
  }, [messages]);

  const viewerConfig = useMemo(() => {
    if (secretMode) {
      return DEMO_MODELS[DEMO_KEYS[secretIndex]];
    }

    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
    const lastAssistantText = lastAssistant
      ? getTextFromParts(lastAssistant.parts as Array<{ type: string; text?: string }>)
      : '';
    const parsedConfig = lastAssistantText ? extractViewerConfig(lastAssistantText) : null;

    if (activeUserMutation && DEMO_MODELS[activeUserMutation]) {
      const cached = DEMO_MODELS[activeUserMutation];
      if (!parsedConfig) return cached;
      return {
        ...parsedConfig,
        pdbUrl: cached.pdbUrl,
        mutationLabel: parsedConfig.mutationLabel || cached.mutationLabel,
        chain: parsedConfig.chain || cached.chain,
      };
    }

    return parsedConfig;
  }, [activeUserMutation, messages, secretIndex, secretMode]);

  const timelineState = useMemo(() => {
    const hasUserMessage = messages.some((message) => message.role === 'user');
    const hasAssistantMessage = messages.some((message) => message.role === 'assistant');
    const maxIndex = TIMELINE_STOPS.length - 1;

    if (!hasUserMessage) {
      return { completedIndex: -1, activeIndex: -1 };
    }

    if (isLoading) {
      const completedIndex = Math.min(maxIndex - 1, Math.floor(loadingSeconds / 3));
      return { completedIndex, activeIndex: Math.min(maxIndex, completedIndex + 1) };
    }

    if (hasAssistantMessage) {
      return { completedIndex: maxIndex, activeIndex: -1 };
    }

    return { completedIndex: 0, activeIndex: 1 };
  }, [isLoading, loadingSeconds, messages]);

  const handleExample = (query: string) => {
    append({ role: 'user', content: query });
  };

  return (
    <main>
      <div className="archive-container">
        {/* header */}
        <div className="animate-entrance animate-delay-1" style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img
            src="/icon.png"
            alt="Mutation Storyteller logo"
            style={{ width: '80px', height: '80px', marginBottom: '16px', display: 'inline-block' }}
          />
          <h1 style={{ marginBottom: '8px' }}>
            mutation storyteller<span className="hero-cursor" />
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '1.1em', margin: 0 }}>
            Type a mutation. See the protein. Understand the science.
          </p>
          <p style={{ color: 'var(--faded)', fontSize: '0.85em', marginTop: '6px', maxWidth: '860px', marginInline: 'auto' }}>
            Rosie was diagnosed with a severe tumor and an AI-assisted vaccine design process helped accelerate the path to treatment.
            This interface is built to make early biomolecular research steps understandable and accessible for more people.
          </p>
          <p style={{ color: 'var(--faded)', fontSize: '0.8em', marginTop: '6px' }}>
            Powered by AlphaFold + Gemini
          </p>
          {secretMode && (
            <p style={{
              color: 'var(--accent)',
              fontSize: '0.75em',
              marginTop: '8px',
              letterSpacing: '0.25em',
              fontWeight: 'bold',
            }}>
              Radio Mode Active
            </p>
          )}
        </div>

        <div className="animate-entrance animate-delay-2" style={{
          marginBottom: '20px',
          border: '1px solid var(--ink)',
          background: 'var(--card)',
          padding: '14px',
        }}>
          <p className="module-header">RESEARCH TIMELINE</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, minmax(0, 1fr))', gap: '8px' }} className="timeline-grid">
            {TIMELINE_STOPS.map((stop, index) => {
              const isCompleted = index <= timelineState.completedIndex;
              const isActive = index === timelineState.activeIndex;
              const stepClass = `timeline-step${isCompleted ? ' completed' : ''}${isActive ? ' active' : ''}`;
              return (
                <div key={stop.id} className={stepClass}>
                  <div className="timeline-bar" />
                  <p className="timeline-title">{stop.title}</p>
                  <p className="timeline-subtitle">{stop.subtitle}</p>
                </div>
              );
            })}
          </div>
          <style>{`
            @media (min-width: 900px) {
              .timeline-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
            }
          `}</style>
        </div>

        {/* main grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '24px',
        }}>
          {/* on large screens: 3/5 chat + 2/5 viewer */}
          <style>{`
            @media (min-width: 1024px) {
              .main-grid { grid-template-columns: 3fr 2fr !important; }
            }
          `}</style>
          <div className="main-grid" style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '24px',
          }}>
            {/* chat column */}
            <div className="animate-entrance animate-delay-2" style={{ display: 'flex', flexDirection: 'column' }}>
              {/* example buttons */}
              {messages.length === 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <p style={{ color: 'var(--muted)', fontSize: '0.85em', marginBottom: '10px' }}>Try one of these:</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {EXAMPLES.map((ex) => (
                      <button
                        key={ex.label}
                        onClick={() => handleExample(ex.label)}
                        className="example-btn"
                      >
                        <span style={{ fontWeight: 'bold' }}>{ex.label}</span>
                        <span className="example-subtitle">{ex.subtitle}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* messages */}
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                marginBottom: '16px',
                overflowY: 'auto',
                maxHeight: '600px',
              }}>
                {messages.map((m) => {
                  const text = getTextFromParts(m.parts as Array<{ type: string; text?: string }>);
                  return (
                    <div key={m.id} style={m.role === 'user' ? { textAlign: 'right' } : {}}>
                      {m.role === 'user' ? (
                        <div className="message-user">{text}</div>
                      ) : (
                        <div className="message-assistant">{cleanContent(text)}</div>
                      )}
                    </div>
                  );
                })}
                {isLoading && <div className="message-loading">Researching...</div>}
                {error && (
                  <div className="message-error">{error.message}</div>
                )}
              </div>

              {/* input form */}
              <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px' }}>
                <input
                  value={input}
                  onChange={handleInputChange}
                  placeholder="Enter a mutation (e.g., TREM2 R47H)"
                  className="archive-input"
                />
                <button type="submit" disabled={isLoading} className="archive-submit">
                  Go
                </button>
              </form>
            </div>

            {/* viewer column */}
            <div className="animate-entrance animate-delay-3">
              <ProteinViewer config={viewerConfig} secretMode={secretMode} />
              {viewerConfig && (
                <p className="viewer-source">
                  Source: AlphaFold DB | Residue {viewerConfig.highlightResidue} highlighted
                </p>
              )}
            </div>
          </div>
        </div>

        {/* footer */}
        <div className="archive-footer">
          Not medical advice. Data from UniProt, AlphaFold, PubMed, ClinVar.
        </div>
      </div>
    </main>
  );
}
