export interface ClinVarRecord {
  title?: string;
  clinical_significance?: { description?: string };
  germline_classification?: { description?: string; review_status?: string; last_evaluated?: string };
  oncogenicity_classification?: { description?: string };
  clinical_impact_classification?: { description?: string };
}
export function clinicalRecord(id: string, record: ClinVarRecord) {
  return {
    uid: id, title: record.title,
    clinicalSignificance: record.germline_classification?.description || record.clinical_significance?.description,
    reviewStatus: record.germline_classification?.review_status,
    lastEvaluated: record.germline_classification?.last_evaluated,
    oncogenicity: record.oncogenicity_classification?.description,
    clinicalImpact: record.clinical_impact_classification?.description,
    url: `https://www.ncbi.nlm.nih.gov/clinvar/variation/${id}/`,
  };
}
