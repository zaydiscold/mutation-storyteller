import { streamText, tool } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { SYSTEM_PROMPT } from '@/lib/prompts';

export const maxDuration = 60;

// ============================================================
// MODEL SWITCH — change this one line to swap Gemini models
// ============================================================
const MODEL = google('gemini-2.5-flash-preview-05-20');
// const MODEL = google('gemini-2.0-flash');
// const MODEL = google('gemini-3.1-pro');
// ============================================================

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: MODEL,
    system: SYSTEM_PROMPT,
    messages,
    maxSteps: 8,
    tools: {
      searchUniprot: tool({
        description: 'Search UniProt for protein information by gene name',
        parameters: z.object({
          geneName: z.string().describe('Gene symbol like TREM2, BRCA1, TP53'),
        }),
        execute: async ({ geneName }) => {
          try {
            const res = await fetch(
              `https://rest.uniprot.org/uniprotkb/search?query=${geneName}+AND+organism_id:9606&format=json&size=1`
            );
            const data = await res.json();
            if (!data.results?.length) return { error: 'Protein not found' };
            const protein = data.results[0];
            return {
              accession: protein.primaryAccession,
              name: protein.proteinDescription?.recommendedName?.fullName?.value,
              gene: protein.genes?.[0]?.geneName?.value,
              function: protein.comments?.find((c: any) => c.commentType === 'FUNCTION')?.texts?.[0]?.value,
              diseases: protein.comments?.filter((c: any) => c.commentType === 'DISEASE')?.map((d: any) => ({
                name: d.disease?.diseaseId,
                description: d.texts?.[0]?.value,
              })),
              sequenceLength: protein.sequence?.length,
            };
          } catch (e) {
            return { error: 'UniProt request failed' };
          }
        },
      }),

      fetchAlphaFold: tool({
        description: 'Fetch AlphaFold predicted 3D structure for a UniProt accession',
        parameters: z.object({
          uniprotAccession: z.string().describe('UniProt accession like Q9NZC2'),
        }),
        execute: async ({ uniprotAccession }) => {
          try {
            const res = await fetch(
              `https://alphafold.ebi.ac.uk/api/prediction/${uniprotAccession}`
            );
            if (!res.ok) return { error: 'AlphaFold structure not found' };
            const data = await res.json();
            const entry = Array.isArray(data) ? data[0] : data;
            return {
              pdbUrl: entry.pdbUrl,
              cifUrl: entry.cifUrl,
              paeImageUrl: entry.paeImageUrl,
            };
          } catch (e) {
            return { error: 'AlphaFold request failed' };
          }
        },
      }),

      searchPubMed: tool({
        description: 'Search PubMed for recent papers about a gene and variant',
        parameters: z.object({
          query: z.string().describe('Search query like "TREM2 R47H Alzheimer"'),
        }),
        execute: async ({ query }) => {
          try {
            const searchRes = await fetch(
              `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmode=json&retmax=5&sort=date`
            );
            const searchData = await searchRes.json();
            const ids = searchData.esearchresult?.idlist || [];
            if (ids.length === 0) return { papers: [] };
            const summaryRes = await fetch(
              `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`
            );
            const summaryData = await summaryRes.json();
            return {
              papers: ids.map((id: string) => {
                const paper = summaryData.result?.[id];
                return {
                  pmid: id,
                  title: paper?.title,
                  authors: paper?.authors?.slice(0, 3)?.map((a: any) => a.name),
                  journal: paper?.source,
                  url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
                };
              }),
            };
          } catch (e) {
            return { papers: [], error: 'PubMed request failed' };
          }
        },
      }),

      searchClinVar: tool({
        description: 'Search ClinVar for clinical significance of a genetic variant',
        parameters: z.object({
          geneName: z.string().describe('Gene symbol'),
          variant: z.string().describe('Variant like R47H, C61G'),
        }),
        execute: async ({ geneName, variant }) => {
          try {
            const res = await fetch(
              `https://clinicaltables.nlm.nih.gov/api/variants/v4/search?terms=${geneName}+${variant}&df=Name,ClinicalSignificance,PhenotypeList,GeneSymbol&maxList=5`
            );
            const data = await res.json();
            if (data[3]?.length > 0) {
              return {
                results: data[3].map((row: string[]) => ({
                  name: row[0],
                  clinicalSignificance: row[1],
                  phenotypes: row[2],
                  gene: row[3],
                })),
              };
            }
            // E-utils fallback
            const searchRes = await fetch(
              `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=clinvar&term=${geneName}[gene]+AND+${variant}&retmode=json&retmax=5`
            );
            const searchData = await searchRes.json();
            const ids = searchData.esearchresult?.idlist || [];
            if (ids.length === 0) return { results: [] };
            const summaryRes = await fetch(
              `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=clinvar&id=${ids.join(',')}&retmode=json`
            );
            const summaryData = await summaryRes.json();
            return {
              results: ids.map((id: string) => {
                const record = summaryData.result?.[id];
                return { uid: id, title: record?.title, clinicalSignificance: record?.clinical_significance?.description };
              }),
            };
          } catch (e) {
            return { results: [], error: 'ClinVar request failed' };
          }
        },
      }),
    },
  });

  return result.toDataStreamResponse();
}
