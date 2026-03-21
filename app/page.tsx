'use client';

import { useChat } from 'ai/react';
import { useEffect, useState } from 'react';
import { ProteinViewer } from '@/components/ProteinViewer';

interface ViewerConfig {
  pdbUrl: string;
  highlightResidue: number;
  chain: string;
  mutationLabel: string;
}

const EXAMPLES = [
  { label: 'TREM2 R47H', subtitle: "Alzheimer's" },
  { label: 'TP53 R175H', subtitle: 'Cancer' },
  { label: 'BRCA1 C61G', subtitle: 'Breast Cancer' },
  { label: 'CFTR F508del', subtitle: 'Cystic Fibrosis' },
];

function extractViewerConfig(content: string): ViewerConfig | null {
  const match = content.match(/\{"viewer":\s*\{[^}]+\}\}/);
  if (match) {
    try { return JSON.parse(match[0]).viewer; } catch { return null; }
  }
  return null;
}

export default function Home() {
  const { messages, input, handleInputChange, handleSubmit, isLoading, append } = useChat();
  const [viewerConfig, setViewerConfig] = useState<ViewerConfig | null>(null);

  useEffect(() => {
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
    if (lastAssistant?.content) {
      const config = extractViewerConfig(lastAssistant.content);
      if (config) setViewerConfig(config);
    }
  }, [messages]);

  const handleExample = (query: string) => {
    append({ role: 'user', content: query });
  };

  const cleanContent = (content: string) => {
    return content.replace(/```json\s*\{"viewer":[^`]*```/g, '').trim();
  };

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight mb-2">Mutation Storyteller</h1>
          <p className="text-zinc-400 text-lg">Type a mutation. See the protein. Understand the science.</p>
          <p className="text-zinc-600 text-sm mt-1">Powered by AlphaFold + Gemini</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 flex flex-col">
            {messages.length === 0 && (
              <div className="mb-6">
                <p className="text-zinc-500 text-sm mb-3">Try one of these:</p>
                <div className="flex flex-wrap gap-2">
                  {EXAMPLES.map((ex) => (
                    <button key={ex.label} onClick={() => handleExample(ex.label)}
                      className="px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg hover:bg-zinc-800 hover:border-zinc-600 transition-colors text-sm">
                      <span className="font-medium">{ex.label}</span>
                      <span className="text-zinc-500 ml-2">{ex.subtitle}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex-1 space-y-4 mb-4 overflow-y-auto max-h-[600px]">
              {messages.map((m) => (
                <div key={m.id} className={m.role === 'user' ? 'text-right' : ''}>
                  {m.role === 'user' ? (
                    <div className="inline-block bg-zinc-800 rounded-lg px-4 py-2 text-sm">{m.content}</div>
                  ) : (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
                      {cleanContent(m.content)}
                    </div>
                  )}
                </div>
              ))}
              {isLoading && <div className="text-zinc-500 text-sm animate-pulse">Researching...</div>}
            </div>

            <form onSubmit={handleSubmit} className="flex gap-2">
              <input value={input} onChange={handleInputChange}
                placeholder="Enter a mutation (e.g., TREM2 R47H)"
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-zinc-500" />
              <button type="submit" disabled={isLoading}
                className="px-6 py-3 bg-white text-black rounded-lg font-medium text-sm hover:bg-zinc-200 disabled:opacity-50 transition-colors">
                Go
              </button>
            </form>
          </div>

          <div className="lg:col-span-2">
            <ProteinViewer config={viewerConfig} />
            {viewerConfig && (
              <p className="text-zinc-600 text-xs mt-2 text-center">
                Source: AlphaFold DB | Residue {viewerConfig.highlightResidue} highlighted
              </p>
            )}
          </div>
        </div>

        <div className="mt-8 text-center text-zinc-700 text-xs">
          Not medical advice. Data from UniProt, AlphaFold, PubMed, ClinVar.
        </div>
      </div>
    </main>
  );
}
