import type { Evidence } from '@/lib/use-research';
const NAMES: Record<string, string> = { searchUniprot: 'UniProt', fetchAlphaFold: 'AlphaFold', searchPubMed: 'PubMed', searchClinVar: 'ClinVar' };
function text(value: unknown) { return typeof value === 'string' || typeof value === 'number' ? String(value) : ''; }
function safeLink(value: unknown) { return typeof value === 'string' && /^https:\/\//.test(value) ? value : undefined; }
export function EvidencePanel({ evidence }: { evidence: Evidence[] }) {
  if (!evidence.length) return null;
  return <section className="evidence-panel" aria-label="Retrieved evidence"><h2 className="module-header">SOURCE RECORDS</h2>
    {evidence.map(source => {
      const data = source.output || {};
      const records = Array.isArray(data.papers) ? data.papers : Array.isArray(data.results) ? data.results : [];
      return <details key={source.id} className="source-record">
        <summary>{NAMES[source.name] || source.name} <span>{source.status === 'loading' ? 'Looking up...' : source.status === 'error' ? 'Unavailable' : 'Retrieved'}</span></summary>
        {source.status === 'loading' ? <p className="small-note">Waiting for this source.</p> : <>
          {text(data.error) && <p className="small-note">{text(data.error)}</p>}
          {text(data.name) && <h3>{text(data.name)} {text(data.accession) && `(${text(data.accession)})`}</h3>}
          {text(data.function) && <p>{text(data.function)}</p>}
          {data.sequenceLength != null && <p>Reference sequence: {text(data.sequenceLength)} residues.</p>}
          {text(data.structureType) && <p>Structure: {text(data.structureType)}. This does not simulate the mutation.</p>}
          {records.length > 0 && <ul>{records.map((record, index) => <li key={index}>
            {safeLink(record.url) ? <a href={safeLink(record.url)} target="_blank" rel="noreferrer">{text(record.title) || text(record.name) || 'Source record'}</a> : <strong>{text(record.title) || text(record.name)}</strong>}
            {record.journal && <p className="small-note">{text(record.journal)} · {text(record.publicationDate)} · PMID {text(record.pmid)}</p>}
            {record.clinicalSignificance && <p>Reported classification: {text(record.clinicalSignificance)}</p>}
            {record.reviewStatus && <p className="small-note">Review status: {text(record.reviewStatus)} · Last evaluated: {text(record.lastEvaluated)}</p>}
            {record.phenotypes && <p>Reported conditions: {text(record.phenotypes)}</p>}
          </li>)}</ul>}
          {(Array.isArray(data.papers) || Array.isArray(data.results)) && !records.length && !data.error && <p>No matching records returned by this search.</p>}
          {text(data.evidenceScope) && <p className="small-note">{text(data.evidenceScope)}</p>}
          {source.name === 'searchClinVar' && <p className="small-note">Search matches need variant and transcript identity review before interpreting their classifications.</p>}
          {safeLink(data.sourceUrl) && <a href={safeLink(data.sourceUrl)} target="_blank" rel="noreferrer">Open original source</a>}
          {text(data.retrievedAt) && <p className="small-note">Retrieved {text(data.retrievedAt)}</p>}
          <details className="raw-record"><summary>Inspect full source record</summary><pre>{JSON.stringify(source.output || source.input, null, 2)}</pre></details>
        </>}
      </details>;
    })}
  </section>;
}
