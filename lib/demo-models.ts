export interface ViewerConfig {
  pdbUrl: string;
  highlightResidue: number;
  chain: string;
  mutationLabel: string;
}

export const DEMO_MODELS: Record<string, ViewerConfig> = {
  'trem2 r47h': {
    pdbUrl: '/models/trem2_q9nzc2.pdb',
    highlightResidue: 47,
    chain: 'A',
    mutationLabel: 'TREM2 R47H',
  },
  'tp53 r175h': {
    pdbUrl: '/models/tp53_p04637.pdb',
    highlightResidue: 175,
    chain: 'A',
    mutationLabel: 'TP53 R175H',
  },
  'brca1 c61g': {
    pdbUrl: '/models/brca1_p38398.pdb',
    highlightResidue: 61,
    chain: 'A',
    mutationLabel: 'BRCA1 C61G',
  },
  'cftr f508del': {
    pdbUrl: '/models/cftr_p13569.pdb',
    highlightResidue: 508,
    chain: 'A',
    mutationLabel: 'CFTR F508del',
  },
};

export const DEMO_KEYS = Object.keys(DEMO_MODELS);

export function normalizeMutationQuery(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, ' ');
}

