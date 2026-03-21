'use client';

import { useEffect, useRef } from 'react';

interface ViewerConfig {
  pdbUrl: string;
  highlightResidue: number;
  chain: string;
  mutationLabel: string;
}

declare global {
  interface Window {
    $3Dmol: any;
  }
}

export function ProteinViewer({ config }: { config: ViewerConfig | null }) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const viewerInstance = useRef<any>(null);

  useEffect(() => {
    if (!config || !viewerRef.current || !window.$3Dmol) return;

    if (viewerInstance.current) {
      viewerInstance.current.clear();
    }

    const v = window.$3Dmol.createViewer(viewerRef.current, {
      backgroundColor: '0x0a0a0a',
    });
    viewerInstance.current = v;

    fetch(config.pdbUrl)
      .then(res => res.text())
      .then(pdbData => {
        v.addModel(pdbData, 'pdb');
        v.setStyle({}, { cartoon: { color: 'spectrum' } });
        v.setStyle(
          { resi: config.highlightResidue, chain: config.chain },
          { stick: { color: 'red', radius: 0.3 }, cartoon: { color: 'red' } }
        );
        v.addLabel(config.mutationLabel, {
          position: { resi: config.highlightResidue, chain: config.chain },
          backgroundColor: '#ef4444',
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

    return () => { if (viewerInstance.current) viewerInstance.current.clear(); };
  }, [config]);

  if (!config) {
    return (
      <div className="w-full h-[500px] bg-zinc-900 rounded-xl border border-zinc-800 flex items-center justify-center text-zinc-500 text-sm">
        3D protein structure will appear here
      </div>
    );
  }

  return <div ref={viewerRef} className="w-full h-[500px] bg-zinc-900 rounded-xl border border-zinc-800" />;
}
