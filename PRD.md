# MUTATION STORYTELLER (Rosie) -- PRD
## Vercel x DeepMind Hackathon | March 21, 2026 | Solo

## WHAT
Web app. Type a mutation (e.g. "TREM2 R47H"). Get: 3D spinning protein with mutation highlighted red + plain-English narrative with real citations from 4 bio databases. Powered by Gemini + AlphaFold.

## WHY IT WINS
- **Live Demo (45%):** 3D protein viewer = most visual thing in the room. Pre-validated mutations = won't fail.
- **Creativity (35%):** Connects DeepMind's own AlphaFold to their own Gemini. Nobody else is rendering proteins. Rosie story is the hook.
- **Impact (20%):** "AlphaFold's missing interface." Real gap, real pitch.

## PROBLEM STATEMENT: Statement 3 (AI Applications) + touches Statement 2 (Multimodal via PAE image analysis if time allows)

## THE PITCH
"Two weeks ago, a guy in Australia with no biology background used ChatGPT and AlphaFold to design a cancer vaccine for his dog Rosie. Tumor shrank 75%. AlphaFold predicted 200M protein structures. Most people can't read the output. We built the interface."

## STACK
Next.js (App Router) + Vercel AI SDK + Gemini + 3Dmol.js (CDN) + Tailwind. No DB, no auth, no Supabase, no ElevenLabs.

## API KEY
```
GOOGLE_GENERATIVE_AI_API_KEY=<set in .env.local>
```

## GEMINI MODEL FALLBACK
1. `google("gemini-2.5-flash-preview-05-20")`
2. `google("gemini-2.0-flash")`
3. `google("gemini-3.1-pro")`
Nuclear: hardcode API calls, pass results to Gemini as context.

## DEMO MUTATIONS (pre-validated)
| Input | UniProt | Residue | Disease |
|-------|---------|---------|---------|
| TREM2 R47H | Q9NZC2 | 47 | Alzheimer's |
| TP53 R175H | P04637 | 175 | Cancer |
| BRCA1 C61G | P38398 | 61 | Breast cancer |
| CFTR F508del | P13569 | 508 | Cystic fibrosis |

**Always use AlphaFold PDBs (UniProt numbering). Never experimental PDBs.**

## APIs (free, no auth)
- **UniProt:** `GET https://rest.uniprot.org/uniprotkb/search?query={GENE}+AND+organism_id:9606&format=json&size=1`
- **AlphaFold:** `GET https://alphafold.ebi.ac.uk/api/prediction/{UNIPROT_ID}` / Direct PDB: `https://alphafold.ebi.ac.uk/files/AF-{ID}-F1-model_v4.pdb`
- **PubMed:** esearch then esummary at `eutils.ncbi.nlm.nih.gov`
- **ClinVar:** `GET https://clinicaltables.nlm.nih.gov/api/variants/v4/search?terms={GENE}+{VARIANT}&df=Name,ClinicalSignificance,PhenotypeList,GeneSymbol&maxList=5`

Priority: UniProt + AlphaFold = must. PubMed = should. ClinVar = nice to have.

## DATA FLOW: CHAT -> VIEWER
Gemini emits JSON in response: `{"viewer": {"pdbUrl": "...", "highlightResidue": 47, "chain": "A", "mutationLabel": "R47H"}}`
Client useEffect regex-matches this, passes to ProteinViewer component.

## BUILD ORDER
**Phase 0 (15 min):** Scaffold Next.js, install deps, deploy to Vercel. Gate: app loads on URL.
**Phase 1 (45 min):** Gemini + searchUniprot + fetchAlphaFold tools + chat UI. maxSteps: 8. Gate: "TREM2 R47H" triggers tools.
**Phase 2 (45 min):** 3Dmol.js viewer, parse viewer JSON from stream, split layout. Gate: protein spins, residue 47 red.
**Phase 3 (60 min):** PubMed + ClinVar tools, dark theme polish, example buttons. Gate: 3+ mutations work.
**Phase 4 (30 min):** Record video, submit. Gate: submitted before 5PM.

## GOTCHAS
- Zod schemas: all required fields. No .optional(). Known Gemini bug.
- 3Dmol.js: CDN Script tag only. window.$3Dmol in useEffect. Fixed h-[500px].
- NCBI CORS can be flaky. Proxy through Next.js route if needed.
- Gemini skipping tools: strong prompt ("You MUST call tools") + maxSteps: 8.
- Errors: graceful fallback. Gemini fills gaps from training. Never crash.

## AGENTIC FRAMING (for judges)
Don't say "it calls APIs." Say: "The agent reasons about what data it needs, queries multiple scientific databases, and synthesizes a narrative no single source could produce." The tool-calling sequence IS agent orchestration. Make it visible with status indicators.

## STRETCH (verbal pitch only, don't build)
- PAE image analysis (Gemini vision on AlphaFold confidence heatmap) -- genuinely multimodal, 5 lines of code if time
- Community angle ("fold@home for mutation analysis")
- AlphaFold Server custom predictions

## STARTER CODE
All files in `starter-code/` directory. See SETUP.md for copy instructions.

## TESTING
- [ ] App loads on Vercel
- [ ] TREM2 R47H triggers tools + 3D viewer loads + residue 47 RED
- [ ] At least one other mutation works
- [ ] Public repo, demo video, submitted before 5PM
