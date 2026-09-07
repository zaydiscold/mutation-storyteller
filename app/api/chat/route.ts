import { stepCountIs, streamText, tool } from 'ai';
import { resolveProvider } from '@/lib/providers';
import { clinicalRecord, type ClinVarRecord } from '@/lib/clinvar-record';
import { researchEventResponse } from '@/lib/research-stream';
import { z } from 'zod';
import { SYSTEM_PROMPT } from '@/lib/prompts';
import { ChatRequestError, readChatRequest } from '@/lib/chat-request';
import { fetchSourceJson } from '@/lib/source-fetch';
import { isAllowedPdbUrl } from '@/lib/research-state';
import { researchTextResponse } from '@/lib/text-stream';

export const maxDuration = 60;

type UniProtComment = {
  commentType?: string;
  texts?: Array<{ value?: string }>;
  disease?: { diseaseId?: string };
};
type UniProtProtein = {
  primaryAccession: string;
  proteinDescription?: { recommendedName?: { fullName?: { value?: string } } };
  genes?: Array<{ geneName?: { value?: string } }>;
  comments?: UniProtComment[];
  sequence?: { length?: number };
};
type SearchResult = { esearchresult?: { idlist?: string[] } };
type PubMedRecord = { title?: string; authors?: Array<{ name?: string }>; source?: string; pubdate?: string };
type AlphaFoldEntry = { pdbUrl?: string; cifUrl?: string; paeImageUrl?: string };
const geneSchema = z.string().trim().min(1).max(32).regex(/^[A-Za-z0-9][A-Za-z0-9-]*$/);
const provenance = (sourceUrl: string) => ({ sourceUrl, retrievedAt: new Date().toISOString() });

function searchUrl(database: string, term: string): string {
  const url = new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi');
  url.search = new URLSearchParams({ db: database, term, retmode: 'json', retmax: '5', ...(database === 'pubmed' ? { sort: 'date' } : {}) }).toString();
  return url.toString();
}
function summaryUrl(database: string, ids: string[]): string {
  return `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?${new URLSearchParams({ db: database, id: ids.join(','), retmode: 'json' })}`;
}
function resultIds(result: SearchResult): string[] {
  return Array.isArray(result.esearchresult?.idlist)
    ? result.esearchresult.idlist.filter((id) => typeof id === 'string' && /^\d+$/.test(id)).slice(0, 5) : [];
}

export async function POST(req: Request) {
  let messages;
  try {
    messages = await readChatRequest(req);
  } catch (error) {
    const known = error instanceof ChatRequestError;
    return new Response(known ? error.message : 'Invalid request.', {
      status: known ? error.status : 400, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
  let provider;
  try { provider = resolveProvider(req.headers); }
  catch (error) { return new Response((error as Error).message, { status: 400 }); }

  const controller = new AbortController();
  const signal = AbortSignal.any([req.signal, controller.signal, AbortSignal.timeout(55000)]);
  const sourceFailure = (source: string) => {
    if (signal.aborted) throw signal.reason;
    return { error: `${source} data unavailable. Do not treat this as a negative finding.` };
  };

  try {
    const result = streamText({
      model: provider.model,
      system: `${SYSTEM_PROMPT}
Report depth: ${provider.depth === "detailed" ? "Write a detailed evidence review with clear headings, source-specific limitations, and unresolved questions. Use up to 900 words when the retrieved evidence supports it." : "Write a concise overview of up to 250 words."}

EVIDENCE LIMITS:
- An AlphaFold reference prediction is not a simulated mutant. Do not infer mutation effects or clinical pathogenicity from its shape or confidence alone.
- PubMed results here contain titles and bibliographic metadata, not abstracts or full text. Do not invent study findings from titles. State this limitation explicitly.
- Failed source retrieval is unavailable evidence, not evidence of absence. Keep uncertainty visible and cite only records actually returned.`,
      messages,
      abortSignal: signal,
      maxRetries: 1,
      stopWhen: stepCountIs(8),
      onError: () => {},
      tools: {
        searchUniprot: tool({
          description: 'Search UniProt for protein information by gene name',
          inputSchema: z.object({ geneName: geneSchema.describe('Gene symbol like TREM2, BRCA1, TP53') }),
          execute: async ({ geneName }) => {
            try {
              const query = `(gene_exact:${geneName} OR gene:${geneName}) AND organism_id:9606 AND reviewed:true`;
              const url = `https://rest.uniprot.org/uniprotkb/search?${new URLSearchParams({ query, format: 'json', size: '1' })}`;
              const data = await fetchSourceJson<{ results?: UniProtProtein[] }>(url, signal);
              const protein = data.results?.[0];
              if (!protein?.primaryAccession) return { error: 'Protein not found', ...provenance(url) };
              const comments = protein.comments ?? [];
              return {
                accession: protein.primaryAccession,
                name: protein.proteinDescription?.recommendedName?.fullName?.value,
                gene: protein.genes?.[0]?.geneName?.value,
                function: comments.find((item) => item.commentType === 'FUNCTION')?.texts?.[0]?.value,
                diseases: comments.filter((item) => item.commentType === 'DISEASE').map((item) => ({ name: item.disease?.diseaseId, description: item.texts?.[0]?.value })),
                sequenceLength: protein.sequence?.length,
                ...provenance(`https://www.uniprot.org/uniprotkb/${encodeURIComponent(protein.primaryAccession)}/entry`),
              };
            } catch { return sourceFailure('UniProt'); }
          },
        }),
        fetchAlphaFold: tool({
          description: 'Fetch an AlphaFold reference prediction, not a simulated mutant structure',
          inputSchema: z.object({ uniprotAccession: z.string().trim().min(1).max(20).regex(/^[A-Za-z0-9]+(?:-\d+)?$/) }),
          execute: async ({ uniprotAccession }) => {
            try {
              const url = `https://alphafold.ebi.ac.uk/api/prediction/${encodeURIComponent(uniprotAccession)}`;
              const data = await fetchSourceJson<AlphaFoldEntry[] | AlphaFoldEntry>(url, signal);
              const entry = Array.isArray(data) ? data[0] : data;
              if (!entry || !isAllowedPdbUrl(entry.pdbUrl)) return { error: 'No supported AlphaFold structure found', ...provenance(url) };
              return { pdbUrl: entry.pdbUrl, cifUrl: entry.cifUrl, paeImageUrl: entry.paeImageUrl, structureType: 'reference prediction', ...provenance(url) };
            } catch { return sourceFailure('AlphaFold'); }
          },
        }),
        searchPubMed: tool({
          description: 'Search PubMed for paper metadata about a gene and variant. Titles are not full-text evidence.',
          inputSchema: z.object({ query: z.string().trim().min(1).max(500) }),
          execute: async ({ query }) => {
            try {
              const url = searchUrl('pubmed', query);
              const ids = resultIds(await fetchSourceJson<SearchResult>(url, signal));
              if (!ids.length) return { papers: [], ...provenance(url) };
              const data = await fetchSourceJson<{ result?: Record<string, PubMedRecord> }>(summaryUrl('pubmed', ids), signal);
              return {
                papers: ids.flatMap((id) => {
                  const paper = data.result?.[id];
                  return paper?.title ? [{ pmid: id, title: paper.title, authors: paper.authors?.slice(0, 3).map((author) => author.name), journal: paper.source, publicationDate: paper.pubdate, url: `https://pubmed.ncbi.nlm.nih.gov/${id}/` }] : [];
                }),
                evidenceScope: 'Bibliographic metadata only; abstracts and full text were not retrieved.',
                ...provenance(url),
              };
            } catch { return { papers: [], ...sourceFailure('PubMed') }; }
          },
        }),
        searchClinVar: tool({
          description: 'Search ClinVar for reported clinical significance of a genetic variant',
          inputSchema: z.object({ geneName: geneSchema, variant: z.string().trim().min(1).max(80) }),
          execute: async ({ geneName, variant }) => {
            const url = `https://clinicaltables.nlm.nih.gov/api/variants/v4/search?${new URLSearchParams({ terms: `${geneName} ${variant}`, df: 'Name,ClinicalSignificance,PhenotypeList,GeneSymbol', maxList: '5' })}`;
            try {
              try {
                const data = await fetchSourceJson<unknown[]>(url, signal);
                const rows = Array.isArray(data[3]) ? data[3].filter((row: unknown) => Array.isArray(row) && row.length >= 4) as string[][] : [];
                if (rows.length) return { results: rows.map((row) => ({ name: row[0], clinicalSignificance: row[1], phenotypes: row[2], gene: row[3] })), ...provenance(url) };
              } catch {
                if (signal.aborted) throw signal.reason;
                // A failed primary source is eligible for the existing E-utils fallback too.
              }
              const fallbackUrl = searchUrl('clinvar', `${geneName}[gene] AND ${variant}`);
              const ids = resultIds(await fetchSourceJson<SearchResult>(fallbackUrl, signal));
              if (!ids.length) return { results: [], ...provenance(fallbackUrl) };
              const data = await fetchSourceJson<{ result?: Record<string, ClinVarRecord> }>(summaryUrl('clinvar', ids), signal);
              return {
                results: ids.flatMap((id) => {
                  const record = data.result?.[id];
                  return record?.title ? [clinicalRecord(id, record)] : [];
                }),
                ...provenance(fallbackUrl),
              };
            } catch { return { results: [], ...sourceFailure('ClinVar') }; }
          },
        }),
      },
    });
    if (req.headers.get('x-rosie-stream') === 'events') {
      return researchEventResponse(result.fullStream, () => controller.abort(), { provider: provider.provider, model: provider.modelId, depth: provider.depth });
    }
    return researchTextResponse(result.fullStream, () => controller.abort());
  } catch (error) {
    controller.abort();
    void error; // Never log provider errors: they may contain request credentials.
    return new Response('Research could not start. Please retry.', { status: 502 });
  }
}
