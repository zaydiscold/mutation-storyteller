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
  pngURI: () => string;
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
  const [spinning, setSpinning] = useState(false);
  const [representation, setRepresentation] = useState('cartoon');
  const [colorMode, setColorMode] = useState('spectrum');
  const [residueInfo, setResidueInfo] = useState('');
  const [sequence, setSequence] = useState<{ key: string; residues: Array<{ id: number; name: string }> } | null>(null);
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
      const response = await fetch(pdbUrl, { signal: controller.signal, credentials: 'omit' });
      if (!response.ok) throw new Error(`Structure download failed (HTTP ${response.status}).`);
      const pdb = await response.text();
      if (disposed) return;
      if (!/^ATOM\s/m.test(pdb)) throw new Error('The download did not contain a valid protein structure.');
      const residues = pdb.split('\n').filter(line => line.startsWith('ATOM') && line.slice(12, 16).trim() === 'CA' && line.slice(21, 22) === chain)
        .map(line => ({ id: Number(line.slice(22, 26)), name: line.slice(17, 20).trim() }));
      setSequence({ key, residues });
      const dark = document.documentElement.getAttribute('data-theme') === 'dark';
      const accent = dark ? '#9b7dff' : '#FF8040';
      let instance = viewerInstance.current;
      if (!instance) {
        try { instance = window.$3Dmol.createViewer(viewerRef.current, { backgroundColor: dark ? '0x2a2a2a' : '0xF1E9D2' }); }
        catch { throw new Error('3D rendering is unavailable in this browser. Enable hardware acceleration or try another browser. The reference sequence is available below.'); }
      }
      viewer = instance;
      viewerInstance.current = instance;
      instance.spin(false);
      instance.clear();
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
      const atoms = instance.selectedAtoms(selection) as Array<{ resn?: string; b?: number }>;
      setResidueInfo(`${atoms[0]?.resn || 'Residue'} ${highlightResidue}, chain ${chain}${typeof atoms[0]?.b === 'number' ? ` · pLDDT ${atoms[0].b.toFixed(1)}` : ''}`);
      instance.zoomTo();
      instance.zoom(0.85);
      instance.render();
      instance.spin(false);
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

  useEffect(() => {
    const viewer = viewerInstance.current;
    if (!viewer || status !== 'ready') return;
    const color = colorMode === 'confidence'
      ? { colorscheme: { prop: 'b', gradient: 'roygb', min: 50, max: 90 } }
      : { color: 'spectrum' };
    viewer.setStyle({}, { [representation]: color });
    viewer.setStyle({ resi: highlightResidue, chain }, { stick: { color: '#C34C16', radius: 0.3 }, [representation]: { color: '#C34C16' } });
    viewer.render();
    viewer.spin(spinning);
  }, [representation, colorMode, status, highlightResidue, chain, spinning]);

  return (
    <section aria-label="Protein viewer">
      <div className={config ? 'viewer-container' : 'viewer-empty'} aria-busy={Boolean(config) && status === 'loading'}>
        <div ref={viewerRef} className="molecule-canvas" style={{ visibility: config ? 'visible' : 'hidden' }} />
        {!config && <span>Select a reference above or research a mutation.</span>}
        {config && status === 'loading' && <p className="viewer-overlay" role="status">Loading reference structure...</p>}
        {config && status === 'error' && <div className="viewer-overlay" role="alert"><p>{load?.message}</p><button type="button" className="example-btn" onClick={() => setRetry(value => value + 1)}>Retry structure</button></div>}
        {secretMode && config && status === 'ready' && <div className="radio-overlay" aria-hidden="true">{spikes.map((height, index) => <div key={index} className="equalizer-bar" style={{ height: `${Math.min(64, height)}%` }} />)}</div>}
      </div>
      {config && <>
        {sequence?.key === key && <details className="sequence-panel"><summary>Reference sequence · {sequence.residues.length} residues in chain {chain}</summary><p className="small-note">Residues present in this structure. The requested position is highlighted; this is the reference sequence.</p><div className="residue-strip">{sequence.residues.map((residue, i) => <span key={`${residue.id}-${i}`} className={residue.id === highlightResidue ? 'selected-residue' : ''} title={`Position ${residue.id}`}><small>{residue.id}</small>{residue.name}</span>)}</div></details>}
        <p className="small-note" role="status">{status === 'ready' ? residueInfo : ''}</p>
        <div className="control-row viewer-controls">
          <button type="button" className="example-btn" disabled={status !== 'ready'} onClick={() => { viewerInstance.current?.zoomTo(); viewerInstance.current?.zoom(0.85); viewerInstance.current?.render(); }}>Whole protein</button>
          <button type="button" className="example-btn" disabled={status !== 'ready'} onClick={() => { viewerInstance.current?.zoomTo({ resi: highlightResidue, chain }); viewerInstance.current?.zoom(0.65); viewerInstance.current?.render(); }}>Focus residue</button>
          <button type="button" className="example-btn" disabled={status !== 'ready'} aria-pressed={spinning} onClick={() => { viewerInstance.current?.spin(!spinning); setSpinning(!spinning); }}>{spinning ? 'Pause rotation' : 'Rotate'}</button>
          <button type="button" className="example-btn" disabled={status !== 'ready'} onClick={() => { const uri = viewerInstance.current?.pngURI(); if (uri) { const link = document.createElement('a'); link.href = uri; link.download = 'rosie-reference.png'; link.click(); } }}>Save image</button>
        </div>
        <div className="settings-grid viewer-options">
          <label>Representation<select aria-label="Representation" disabled={status !== 'ready'} value={representation} onChange={e => setRepresentation(e.target.value)}><option value="cartoon">Cartoon</option><option value="stick">Sticks</option><option value="line">Lines</option></select></label>
          <label>Color<select aria-label="Color" disabled={status !== 'ready'} value={colorMode} onChange={e => setColorMode(e.target.value)}><option value="spectrum">Sequence position</option><option value="confidence">Prediction confidence</option></select></label>
        </div>
        {colorMode === 'confidence' && <p className="small-note">pLDDT: red ≤50 (low confidence), blue ≥90 (high confidence). Orange marks the requested residue. Confidence describes the reference prediction, not mutation impact.</p>}
        <p className="small-note">Drag to rotate · scroll to zoom. Highlight marks a position on the reference protein; deleted residues remain visible in this reference.</p>
      </>}
    </section>
  );
}
