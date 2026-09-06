'use client';

import { useEffect, useRef, useState } from 'react';
import type { ViewerConfig } from '@/lib/demo-models';
import { isAllowedPdbUrl } from '@/lib/research-state';

interface MolViewer {
  clear: () => void;
  addModel: (data: string, format: string) => void;
  setStyle: (selection: Record<string, unknown>, style: Record<string, unknown>) => void;
  addLabel: (text: string, options: Record<string, unknown>, selection?: Record<string, unknown>) => void;
  selectedAtoms: (selection: Record<string, unknown>) => unknown[];
  zoomTo: (selection?: Record<string, unknown>) => void;
  zoom: (factor: number) => void;
  render: () => void;
  resize: () => void;
  spin: (enabled: boolean) => void;
}

interface Mol3D {
  createViewer: (element: HTMLDivElement, options: { backgroundColor: string }) => MolViewer;
}

declare global { interface Window { $3Dmol?: Mol3D; } }

type LoadState = { key: string; status: 'ready' | 'error'; message?: string };

export function ProteinViewer({ config, secretMode = false }: { config: ViewerConfig | null; secretMode?: boolean }) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const viewerInstance = useRef<MolViewer | null>(null);
  const [load, setLoad] = useState<LoadState | null>(null);
  const [retry, setRetry] = useState(0);
  const [spikes, setSpikes] = useState<number[]>(() => Array(32).fill(10));
  const { pdbUrl = '', highlightResidue = 0, chain = '', mutationLabel = '' } = config ?? {};
  const key = JSON.stringify([pdbUrl, highlightResidue, chain, mutationLabel, retry]);
  const status = load?.key === key ? load.status : 'loading';

  useEffect(() => {
    if (!pdbUrl) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    let disposed = false;
    let resizeObserver: ResizeObserver | undefined;
    let viewer: MolViewer | null = null;

    async function initialize() {
      if (!isAllowedPdbUrl(pdbUrl)) throw new Error('This structure URL is not supported.');
      const libraryDeadline = Date.now() + 10000;
      while (!window.$3Dmol) {
        controller.signal.throwIfAborted();
        if (Date.now() > libraryDeadline) throw new Error('The 3D library did not load. Check your connection and retry.');
        await new Promise((resolve) => window.setTimeout(resolve, 100));
      }
      controller.signal.throwIfAborted();
      if (disposed || !viewerRef.current) return;
      const dark = document.documentElement.getAttribute('data-theme') === 'dark';
      const accent = dark ? '#9b7dff' : '#FF8040';
      const instance = viewerInstance.current ?? window.$3Dmol.createViewer(viewerRef.current, {
        backgroundColor: dark ? '0x2a2a2a' : '0xF1E9D2',
      });
      viewer = instance;
      viewerInstance.current = instance;
      instance.spin(false);
      instance.clear();
      const response = await fetch(pdbUrl, { signal: controller.signal, credentials: 'omit' });
      if (!response.ok) throw new Error(`Structure download failed (HTTP ${response.status}).`);
      const pdb = await response.text();
      if (disposed) return;
      if (!/^ATOM\s/m.test(pdb)) throw new Error('The download did not contain a valid protein structure.');
      instance.addModel(pdb, 'pdb');
      const selection = { resi: highlightResidue, chain };
      if (!instance.selectedAtoms(selection).length) {
        throw new Error('The requested residue is absent from this structure. No highlight was inferred.');
      }
      instance.setStyle({}, { cartoon: { color: 'spectrum' } });
      instance.setStyle(selection, { stick: { color: accent, radius: 0.3 }, cartoon: { color: accent } });
      instance.addLabel(mutationLabel, {
        backgroundColor: accent, fontColor: 'white', fontSize: 14, showBackground: true,
      }, selection);
      instance.zoomTo(selection);
      instance.zoom(0.8);
      instance.render();
      instance.spin(!window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => { if (!disposed) instance.resize(); });
        resizeObserver.observe(viewerRef.current);
      }
      setLoad({ key, status: 'ready' });
    }

    void initialize().catch((error: unknown) => {
      if (disposed) return;
      viewer?.spin(false);
      viewer?.clear();
      setLoad({ key, status: 'error', message: controller.signal.aborted
        ? 'Structure loading timed out. Please retry.'
        : error instanceof Error ? error.message : 'Could not load the protein structure.' });
    }).finally(() => window.clearTimeout(timeout));

    return () => {
      disposed = true;
      controller.abort();
      window.clearTimeout(timeout);
      resizeObserver?.disconnect();
      viewer?.spin(false);
      viewer?.clear();
    };
  }, [pdbUrl, highlightResidue, chain, mutationLabel, retry, key]);

  useEffect(() => {
    if (!secretMode || !pdbUrl || status !== 'ready'
      || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frameId = 0;
    let frame = 0;
    const start = performance.now();
    function tick(timestamp: number) {
      const seconds = (timestamp - start) / 1000;
      const beat = Math.max(0, Math.sin(seconds * Math.PI * 2 * 1.9));
      const viewer = viewerInstance.current;
      if (viewer) {
        viewer.zoomTo({ resi: highlightResidue, chain });
        viewer.zoom(0.74 + beat * 0.22);
        viewer.render();
      }
      if (++frame % 3 === 0) {
        setSpikes(Array.from({ length: 32 }, (_, i) => 8 + Math.round((Math.max(0.15, Math.sin((seconds + i * 0.11) * 7.2)) + beat * 0.7) * 44)));
      }
      frameId = window.requestAnimationFrame(tick);
    }
    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [secretMode, pdbUrl, highlightResidue, chain, status]);

  return (
    <div className={config ? 'viewer-container' : 'viewer-empty'} style={{ position: 'relative' }} aria-busy={Boolean(config) && status === 'loading'}>
      <div ref={viewerRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden', visibility: config ? 'visible' : 'hidden' }} />
      {!config && <span>3d protein structure will appear here</span>}
      {config && status === 'loading' && <p role="status" style={{ position: 'relative', padding: 16 }}>Loading reference structure...</p>}
      {config && status === 'error' && (
        <div role="alert" style={{ position: 'relative', padding: 16 }}>
          <p>{load?.message}</p>
          <button type="button" className="example-btn" onClick={() => setRetry((value) => value + 1)}>Retry structure</button>
        </div>
      )}
      {secretMode && config && status === 'ready' && (
        <div aria-hidden="true" style={{ pointerEvents: 'none', position: 'absolute', left: 12, right: 12, bottom: 12, height: 64, background: 'rgba(0,0,0,0.25)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'flex-end', gap: 2, padding: 8 }}>
          {spikes.map((height, index) => <div key={index} className="equalizer-bar" style={{ height: `${Math.min(64, height)}%` }} />)}
        </div>
      )}
    </div>
  );
}
