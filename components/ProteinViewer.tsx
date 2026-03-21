'use client';

import { useEffect, useRef, useState } from 'react';

interface ViewerConfig {
  pdbUrl: string;
  highlightResidue: number;
  chain: string;
  mutationLabel: string;
}

interface MolViewer {
  clear: () => void;
  addModel: (data: string, format: string) => void;
  setStyle: (selection: Record<string, unknown>, style: Record<string, unknown>) => void;
  addLabel: (text: string, options: Record<string, unknown>) => void;
  zoomTo: (selection?: Record<string, unknown>) => void;
  zoom: (factor: number) => void;
  render: () => void;
  spin: (enabled: boolean) => void;
}

interface Mol3D {
  createViewer: (element: HTMLDivElement, options: { backgroundColor: string }) => MolViewer;
}

declare global {
  interface Window {
    $3Dmol?: Mol3D;
  }
}

function getViewerBg(): string {
  if (typeof document === 'undefined') return '0xF1E9D2';
  const theme = document.documentElement.getAttribute('data-theme');
  return theme === 'dark' ? '0x2a2a2a' : '0xF1E9D2';
}

function getAccentColor(): string {
  if (typeof document === 'undefined') return '#FF8040';
  const theme = document.documentElement.getAttribute('data-theme');
  return theme === 'dark' ? '#9b7dff' : '#FF8040';
}

export function ProteinViewer({ config, secretMode = false }: { config: ViewerConfig | null; secretMode?: boolean }) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const viewerInstance = useRef<MolViewer | null>(null);
  const [spikes, setSpikes] = useState<number[]>(() => Array.from({ length: 32 }, () => 10));

  useEffect(() => {
    if (!config || !viewerRef.current) return;

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout>;

    const init = () => {
      if (cancelled) return;
      if (!window.$3Dmol) {
        retryTimer = setTimeout(init, 100);
        return;
      }

      if (viewerInstance.current) {
        viewerInstance.current.clear();
      }

      const targetElement = viewerRef.current;
      if (!targetElement) return;

      const v = window.$3Dmol.createViewer(targetElement, {
        backgroundColor: getViewerBg(),
      });
      viewerInstance.current = v;

      const accent = getAccentColor();

      fetch(config.pdbUrl)
        .then(res => res.text())
        .then(pdbData => {
          if (cancelled) return;
          v.addModel(pdbData, 'pdb');
          v.setStyle({}, { cartoon: { color: 'spectrum' } });
          v.setStyle(
            { resi: config.highlightResidue, chain: config.chain },
            { stick: { color: accent, radius: 0.3 }, cartoon: { color: accent } }
          );
          v.addLabel(config.mutationLabel, {
            position: { resi: config.highlightResidue, chain: config.chain },
            backgroundColor: accent,
            fontColor: 'white',
            fontSize: 14,
            showBackground: true,
          });
          v.zoomTo({ resi: config.highlightResidue, chain: config.chain });
          v.zoom(0.8);
          v.render();
          v.spin(true);
        })
        .catch(err => console.error('Failed to load PDB:', err));
    };

    init();

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      if (viewerInstance.current) viewerInstance.current.clear();
    };
  }, [config]);

  useEffect(() => {
    if (!secretMode || !config || !viewerInstance.current) return;

    let rafId = 0;
    let frame = 0;
    const start = performance.now();

    const tick = (timestamp: number) => {
      frame += 1;
      const seconds = (timestamp - start) / 1000;
      const beat = Math.max(0, Math.sin(seconds * Math.PI * 2 * 1.9));
      const spikeBoost = Math.random() > 0.965 ? 0.18 : 0;
      const zoomFactor = 0.74 + beat * 0.22 + spikeBoost;

      const viewer = viewerInstance.current;
      if (viewer) {
        viewer.zoomTo({ resi: config.highlightResidue, chain: config.chain });
        viewer.zoom(zoomFactor);
        viewer.render();
      }

      if (frame % 3 === 0) {
        const nextSpikes = Array.from({ length: 32 }, (_, index) => {
          const shape = Math.max(0.15, Math.sin((seconds + index * 0.11) * 7.2));
          const randomNoise = Math.random() * 0.35;
          return 8 + Math.round((shape + randomNoise + beat * 0.7) * 44);
        });
        setSpikes(nextSpikes);
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [config, secretMode]);

  if (!config) {
    return (
      <div className="viewer-empty">
        3d protein structure will appear here
      </div>
    );
  }

  return (
    <div className="viewer-container">
      <div ref={viewerRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'hidden' }} />
      {secretMode && (
        <div style={{
          pointerEvents: 'none',
          position: 'absolute',
          left: '12px',
          right: '12px',
          bottom: '12px',
          height: '64px',
          background: 'rgba(0,0,0,0.25)',
          border: '1px solid var(--accent)',
          backdropFilter: 'blur(1px)',
          display: 'flex',
          alignItems: 'flex-end',
          gap: '2px',
          padding: '8px',
        }}>
          {spikes.map((height, index) => (
            <div
              key={`spike-${index}`}
              className="equalizer-bar"
              style={{ height: `${Math.min(64, height)}%` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
