# Mutation Storyteller — Build Plan
## Vercel x DeepMind "Zero to Agent" Hackathon | March 21, 2026

---

## WHERE WE ARE (as of latest push)

### Working
- Next.js 16 + TypeScript + Tailwind scaffolded and deployed
- Gemini 3.1 Pro (customtools variant) integrated via Vercel AI SDK
- 4 tool definitions: UniProt, AlphaFold, PubMed, ClinVar
- 3Dmol.js loaded via CDN with retry polling (race condition fixed)
- Chat UI with 4 pre-validated example mutation buttons
- Dark theme (black bg, zinc borders)
- System prompt with guardrails (no medical advice, citation requirements, biosecurity)
- Easy model switching (one-line const at top of route.ts)
- API key secured in .env.local (not in git)

### Deployed
- **GitHub:** https://github.com/zaydiscold/mutation-storyteller (public)
- **Vercel:** https://mutation-storyteller.vercel.app
- **Env var:** GOOGLE_GENERATIVE_AI_API_KEY set in Vercel dashboard

### Known Issues / Not Yet Tested
- [ ] End-to-end test: type "TREM2 R47H" and verify all 4 tools fire
- [ ] 3D protein viewer rendering (3Dmol.js loads, but hasn't been tested with real PDB data)
- [ ] Gemini 3.1 Pro tool calling behavior (does it respect maxSteps: 8? does it call all 4 tools?)
- [ ] AlphaFold API may return different JSON shape than expected
- [ ] NCBI (PubMed/ClinVar) CORS — may need server-side proxy

---

## WHERE WE'RE GOING

### Phase 1: Verify Core Flow (priority)
1. Test TREM2 R47H end-to-end on live URL
2. If Gemini doesn't call all tools → adjust prompt or model
3. If 3D viewer doesn't render → debug PDB loading in browser console
4. If NCBI CORS fails → add proxy route at app/api/ncbi/route.ts

### Phase 2: UI Polish (use v0 credits here)
- Tool call status indicators ("Searching UniProt...", "Fetching AlphaFold...")
- Better chat bubble design with markdown rendering
- Distinctive heading font (Google Fonts, not Inter)
- Loading skeleton for protein viewer
- Mobile responsive improvements
- Smooth scroll to viewer when protein loads

### Phase 3: Demo Prep
- Test all 4 demo mutations work
- Record 1-minute demo video
- Write submission description
- Submit before 5PM PT

---

## FILE STRUCTURE

```
mutation-storyteller/
├── app/
│   ├── api/chat/route.ts      ← Gemini + 4 tool definitions
│   ├── layout.tsx             ← Root layout + 3Dmol.js CDN
│   ├── page.tsx               ← Main UI: chat + viewer + examples
│   └── globals.css            ← Tailwind base
├── components/
│   └── ProteinViewer.tsx      ← 3Dmol.js wrapper with retry polling
├── lib/
│   └── prompts.ts             ← System prompt with guardrails
├── .env.local                 ← GOOGLE_GENERATIVE_AI_API_KEY (gitignored)
├── PRD.md                     ← Full product spec
├── AGENT_PROMPT.md            ← Original build instructions
└── BUILD_PLAN.md              ← This file
```

---

## HOW TO PICK THIS UP IN VERCEL v0

1. Go to https://v0.dev
2. Start a new chat
3. Paste this context:

```
I'm building a hackathon project called Mutation Storyteller. It's deployed at https://mutation-storyteller.vercel.app and the code is at https://github.com/zaydiscold/mutation-storyteller

The app lets you type a genetic mutation (like "TREM2 R47H") and get:
- A 3D spinning protein with the mutation highlighted in red (3Dmol.js)
- A plain-English narrative with real citations from UniProt, AlphaFold, PubMed, ClinVar
- Powered by Gemini 3.1 Pro with tool calling via Vercel AI SDK

I need help with: [describe what you need — UI polish, debugging, new features]

Key files:
- app/api/chat/route.ts — Gemini + tool definitions
- app/page.tsx — main UI
- components/ProteinViewer.tsx — 3D protein viewer
- lib/prompts.ts — system prompt

Read BUILD_PLAN.md in the repo for full status.
```

4. v0 can generate UI components — use it for:
   - Better chat bubble components with markdown support
   - Tool call status indicator component
   - Landing page hero section
   - Loading states and skeletons

5. Copy generated components into your project, commit, push, Vercel auto-deploys

---

## DEMO MUTATIONS (pre-validated)

| Input | UniProt | Residue | Disease |
|-------|---------|---------|---------|
| TREM2 R47H | Q9NZC2 | 47 | Alzheimer's |
| TP53 R175H | P04637 | 175 | Cancer |
| BRCA1 C61G | P38398 | 61 | Breast cancer |
| CFTR F508del | P13569 | 508 | Cystic fibrosis |

---

## MODEL CONFIGURATION

In `app/api/chat/route.ts`, line ~11:
```ts
const MODEL = google('gemini-3.1-pro-preview-customtools'); // current
// const MODEL = google('gemini-3-flash-preview');             // fast fallback
// const MODEL = google('gemini-3.1-flash-lite-preview');      // cheapest
// const MODEL = google('gemini-2.5-flash');                   // legacy fallback
```

Uncomment the line you want, comment out the rest.
