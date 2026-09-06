# Mutation Storyteller

Type a mutation, explore a reference protein structure, and read an educational research response grounded in UniProt, AlphaFold, PubMed and ClinVar.

Live app: https://mutation-storyteller.vercel.app

## Run locally

Use Node.js 22 for the development and test commands below.

```bash
npm ci
cp .env.example .env.local
# Set GOOGLE_GENERATIVE_AI_API_KEY in .env.local, then:
npm run dev
```

Open `http://localhost:3000`. Keep the Google key server-side; never use a `NEXT_PUBLIC_` prefix. `GEMINI_MODEL` optionally overrides the existing model default without editing code. Model availability and quotas must be checked with the configured provider account.

## Checks

```bash
npm test                 # Offline regression tests; no dependencies or API key needed
npm run typecheck        # Full application types after npm ci
npm run lint
npm run build
```

The dependency-free test suite runs the actual TypeScript helper modules using Node's type stripping. It does not typecheck them; `typecheck` is a separate command. CI includes regression and full application checks.

## What the interface actually shows

The status panel tracks the current request and response, not fabricated per-database milestones. A plain-text response does not prove every source succeeded. Failures and stopped responses remain visibly incomplete.

The four bundled examples load reference AlphaFold predictions. Highlighting a residue does **not** create a mutant structure or establish an effect on function or disease. Viewer URLs and metadata are validated, and unavailable structures show a retryable error.

PubMed retrieval currently returns bibliographic metadata, not abstracts or full text. The response must not invent paper findings from titles. Generated narratives still require independent source review.

## Stack and scope

Next.js App Router, React, Vercel AI SDK, Google Gemini and 3Dmol.js. This remains a lightweight, in-memory research interface with no database or new authentication dependency. It is not a clinical interpretation or treatment service.

See [reliability and development notes](docs/RELIABILITY.md) for limits, test coverage and remaining work.
