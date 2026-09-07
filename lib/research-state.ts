import type { ViewerConfig } from './demo-models';

export interface ChatMessage {
  role: string;
  content?: unknown;
  parts?: unknown;
}

export function messageText(message: ChatMessage): string {
  if (typeof message.content === 'string') return message.content;
  if (!Array.isArray(message.parts)) return '';
  return message.parts.flatMap((part) =>
    part && part.type === 'text' && typeof part.text === 'string' ? [part.text] : []
  ).join('');
}

/** Only the current turn may drive the timeline or protein viewer. */
export function latestTurn(messages: readonly ChatMessage[]) {
  let index = -1;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === 'user') { index = i; break; }
  }
  const responses = index < 0 ? [] : messages.slice(index + 1).filter((m) => m.role === 'assistant');
  return {
    query: index < 0 ? '' : messageText(messages[index]),
    answer: responses.map(messageText).join('\n'),
  };
}

export function researchPhase(query: string, answer: string, loading: boolean, failed: boolean, stopped: boolean) {
  if (!query) return 'idle';
  if (stopped) return 'stopped';
  if (failed) return 'error';
  if (loading) return answer.trim() ? 'streaming' : 'researching';
  return answer.trim() ? 'response-ready' : 'incomplete';
}

const LOCAL_MODELS = new Set([
  '/models/trem2_q9nzc2.pdb', '/models/tp53_p04637.pdb',
  '/models/brca1_p38398.pdb', '/models/cftr_p13569.pdb',
]);

/** Do not fetch arbitrary model-generated URLs or send queries to third-party hosts. */
export function isAllowedPdbUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (LOCAL_MODELS.has(value)) return true;
  if (!/^https:\/\/alphafold\.ebi\.ac\.uk\/files\/AF-[A-Za-z0-9_.-]+\.pdb$/.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'alphafold.ebi.ac.uk'
      && !url.username && !url.password && !url.port && !url.search && !url.hash;
  } catch { return false; }
}

export function parseViewerConfig(content: string): ViewerConfig | null {
  const blocks = content.matchAll(/\{\s*"viewer"\s*:\s*(\{[^{}]*\})\s*\}/g);
  for (const match of blocks) {
    try {
      const value = JSON.parse(match[1]);
      if (!isAllowedPdbUrl(value.pdbUrl)
        || !Number.isSafeInteger(value.highlightResidue)
        || value.highlightResidue < 1 || value.highlightResidue > 100000
        || typeof value.chain !== 'string' || !/^[A-Za-z0-9]$/.test(value.chain)
        || typeof value.mutationLabel !== 'string' || !value.mutationLabel.trim()
        || value.mutationLabel.length > 80 || /[\x00-\x1f]/.test(value.mutationLabel)) continue;
      return {
        pdbUrl: value.pdbUrl, highlightResidue: value.highlightResidue,
        chain: value.chain, mutationLabel: value.mutationLabel.trim(),
      };
    } catch { /* A streaming JSON block may not be complete yet. */ }
  }
  return null;
}

export function cleanContent(content: string): string {
  return content.replace(/```(?:json)?\s*\{\s*"viewer"\s*:[\s\S]*?```/g, '')
    .replace(/\{\s*"viewer"\s*:\s*\{[^{}]*\}\s*\}/g, '').trim();
}

export function selectViewerConfig(query: string, answer: string, demos: Record<string, ViewerConfig>): ViewerConfig | null {
  const key = query.trim().toLowerCase().replace(/\s+/g, ' ');
  // A known demo's URL, residue, chain and label stay a coherent unit.
  return Object.hasOwn(demos, key) ? demos[key] : parseViewerConfig(answer);
}
