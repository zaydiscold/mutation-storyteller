You are building a hackathon project called Mutation Storyteller. The hackathon is TODAY, Saturday March 21 2026. Submissions due 5:00 PM PT. I am solo. Every minute counts.

## WHAT WE'RE BUILDING

A Next.js web app where you type a genetic mutation like "TREM2 R47H" and get:

1. A 3D spinning protein structure with the mutation site highlighted in red (using 3Dmol.js)
2. A plain-English narrative explaining what the protein does, what breaks when mutated, and why it matters
3. Real data pulled live from UniProt, AlphaFold DB, PubMed, and ClinVar APIs
4. Powered by Google Gemini via Vercel AI SDK with tool calling

This is for the Vercel x DeepMind "Zero to Agent" hackathon. We're presenting AlphaFold (DeepMind's Nobel Prize-winning tool) connected to Gemini (DeepMind's LLM) to DeepMind judges. Statement 3: AI Applications.

## CONTEXT FILES IN THIS FOLDER

This folder contains 8 reference files. They are FLAT (no subdirectories). You need to scaffold the Next.js project and place them correctly:

- `PRD.md` -- Read this FIRST. It has the full spec: APIs, data flow, build phases, gotchas, demo mutations.
- `env.local` -- Rename to `.env.local` and place in project root. Contains the Gemini API key.
- `prompts.ts` -- Place at `lib/prompts.ts`. System prompt for Gemini.
- `route.ts` -- Place at `app/api/chat/route.ts`. Gemini + 4 tool definitions (UniProt, AlphaFold, PubMed, ClinVar).
- `page.tsx` -- Replace `app/page.tsx`. Main UI with chat + 3D viewer + example mutation buttons.
- `layout.tsx` -- Replace `app/layout.tsx`. Loads 3Dmol.js via CDN Script tag.
- `ProteinViewer.tsx` -- Place at `components/ProteinViewer.tsx`. 3Dmol.js wrapper that renders protein + highlights mutation.
- `AGENT_PROMPT.md` -- This file. You're reading it.

## STEP BY STEP -- DO THIS IN ORDER

### Step 1: Scaffold (do this immediately)

```bash
npx create-next-app@latest mutation-storyteller --typescript --tailwind --app --src-dir=false
cd mutation-storyteller
npm install ai @ai-sdk/google zod
```

### Step 2: Place the files

```
env.local           -> .env.local  (rename, project root)
prompts.ts           -> lib/prompts.ts  (create lib/ directory)
route.ts             -> app/api/chat/route.ts  (create app/api/chat/ directory)
page.tsx             -> app/page.tsx  (replace the generated one)
layout.tsx           -> app/layout.tsx  (replace the generated one)
ProteinViewer.tsx    -> components/ProteinViewer.tsx  (create components/ directory)
```

### Step 3: Verify it runs

```bash
npm run dev
```

Open localhost:3000. You should see "Mutation Storyteller" with 4 example buttons.

### Step 4: Test Gemini tool calling

Type "TREM2 R47H" or click the button. Gemini should:

1. Call searchUniprot -> return protein info for TREM2
2. Call fetchAlphaFold -> return PDB URL
3. Call searchPubMed -> return recent papers
4. Call searchClinVar -> return clinical significance
5. Emit a JSON viewer block that triggers the 3D protein viewer
6. Stream a narrative synthesizing all the data

**IF GEMINI TOOL CALLING FAILS:** Change the model in route.ts. Try in order:

1. `google('gemini-2.5-flash-preview-05-20')` (current)
2. `google('gemini-2.0-flash')`
3. `google('gemini-3.1-pro')`

### Step 5: Verify the 3D viewer

When AlphaFold data comes back, a 3D protein should render on the right side of the page. Residue 47 should be highlighted in RED with a label "R47H". The protein should spin.

If the viewer doesn't load, check:

- Is 3Dmol.js loaded? Check browser console for window.$3Dmol
- Is the PDB URL being fetched? Check network tab
- Is the viewer div getting a fixed height? It needs h-[500px], not auto

### Step 6: Deploy to Vercel

```bash
git init
git add .
git commit -m "mutation storyteller"
```

Push to GitHub (MUST be public repo -- hackathon rule). Connect to Vercel and deploy.

### Step 7: Test on Vercel URL

Verify TREM2 R47H works end-to-end on the deployed URL. Then test TP53 R175H to prove it's not hardcoded.

## CRITICAL TECHNICAL NOTES

- **Zod schemas:** Every field MUST be required. No .optional(), no .nullable(). Known Gemini + AI SDK bug breaks tool calling with optional fields.
- **3Dmol.js:** Loaded via CDN Script tag in layout.tsx. Access via window.$3Dmol in useEffect. Do NOT npm install it. Viewer div needs FIXED height (h-[500px]).
- **maxSteps: 8** in the streamText config allows Gemini to make multiple sequential tool calls. Without this, it will only call one tool.
- **Data flow chat -> viewer:** Gemini includes a JSON block `{"viewer": {...}}` in its response. The page.tsx extracts this with regex from the streamed message and passes it to ProteinViewer as state. This is defined in the extractViewerConfig function.
- **AlphaFold PDB numbering:** AlphaFold structures use UniProt numbering. Residue 47 in UniProt = residue 47 in the PDB. Never use experimental PDB structures (like 5ELI) because they use different numbering.
- **NCBI CORS:** If PubMed or ClinVar API calls fail due to CORS, create a proxy route at app/api/ncbi/route.ts that fetches server-side and returns the data.
- **Error handling:** If any API fails, return a graceful error message. Gemini will fill gaps from training knowledge. The app must NEVER crash.

## DEMO MUTATIONS (pre-validated, data exists across all APIs)

- TREM2 R47H (UniProt Q9NZC2, residue 47, Alzheimer's)
- TP53 R175H (UniProt P04637, residue 175, cancer)
- BRCA1 C61G (UniProt P38398, residue 61, breast cancer)
- CFTR F508del (UniProt P13569, residue 508, cystic fibrosis)

## AFTER IT'S WORKING -- POLISH (if time)

- Dark theme should already be there (black bg, zinc borders)
- Add tool call status indicators ("Searching UniProt...", "Fetching AlphaFold...")
- Pick a distinctive Google Font for the heading (not Inter)
- Make sure the example buttons look clean
- Record a 1-minute demo video for submission

## DO NOT

- Add Supabase, ElevenLabs, BetterAuth, or Sentry. Zero demo value.
- Add authentication or user accounts.
- Use localStorage or sessionStorage.
- npm install 3dmol (use CDN).
- Give medical advice in the UI or system prompt.
- Over-engineer the file structure. fewer page, less API route, a few components. That's it.
