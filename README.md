# Mutation Storyteller

Type a mutation, explore a reference protein structure, and read an educational research response grounded in UniProt, AlphaFold, PubMed and ClinVar.

Live app: https://mutation-storyteller.vercel.app

## Run locally

Use Node.js 22 for the development and test commands below.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. No hosted API key is required to explore the four bundled reference structures. For reports, open **Model settings**, select Gemini or OpenRouter, enter your own key, choose a model and report depth, then use **Test connection**. This check makes a small real provider request and may consume quota or credits. Keys remain in tab memory, clear on refresh or **Clear key**, and are sent through this server to the selected provider. The app does not save them.

For hosted generation, set `OPENROUTER_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY` in `.env.local`. If both are set, OpenRouter wins. `OPENROUTER_MODEL` defaults to `openrouter/free`; `GEMINI_MODEL` defaults to `gemini-2.5-flash`. Keep credentials server-side; never use a `NEXT_PUBLIC_` prefix. A configured key is not proof that the provider accepts it.

OpenRouter's free router selects an available model compatible with the request. The free-model menu filters the live catalog for zero prompt/completion prices and tool support. Quotas, capacity and model availability vary; custom models may charge your account. See [provider setup and verification](docs/MODERNIZATION.md).

## Checks

```bash
npm test                 # Offline regression tests; no dependencies or API key needed
npm run typecheck        # Full application types after npm ci
npm run lint
npm run build
npm run test:browser     # Local Google Chrome; starts a test server on port 3107
npm audit
```

The dependency-free test suite runs the actual TypeScript helper modules using Node's type stripping. It does not typecheck them; `typecheck` is a separate command. CI includes regression, full application and Chromium browser checks. For an existing test server, set `ROSIE_TEST_URL` before running the browser tests. CI installs Playwright Chromium with `npx playwright install --with-deps chromium`.

## What the interface actually shows

Reports render Markdown with provider/model attribution, overview or detailed depth, and actual source records streamed independently of the generated prose. Expand a source to inspect returned records, retrieval time, original links and failures. Download the report and source records as Markdown. Failed, stopped and truncated responses remain visibly incomplete, including in exports.

The independent reference selector loads four bundled AlphaFold predictions without generating a report. Viewer controls include whole-protein and residue focus, rotation, cartoon/stick/line representations, sequence-position or prediction-confidence color, and PNG export. The residue strip remains inspectable when WebGL is unavailable.

The four bundled examples load reference AlphaFold predictions. Highlighting a residue does **not** create a mutant structure or establish an effect on function or disease. Viewer URLs and metadata are validated, and unavailable structures show a retryable error.

PubMed retrieval currently returns bibliographic metadata, not abstracts or full text. The response must not invent paper findings from titles. Generated narratives still require independent source review.

## Stack and scope

Next.js App Router, React, Vercel AI SDK, Google Gemini, OpenRouter and locally bundled 3Dmol.js 2.5.5. This remains a lightweight, in-memory research interface with no database or new authentication dependency. It is not a clinical interpretation or treatment service.

See [reliability and development notes](docs/RELIABILITY.md) for limits and test coverage, and [modernization evidence](docs/MODERNIZATION.md) for live-check results and viewer asset provenance. The live app link above does not establish that this branch is deployed.
