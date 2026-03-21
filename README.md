# Mutation Storyteller

Mutation Storyteller is an agentic research interface for biomolecular questions.
You enter a mutation, and the app orchestrates multiple scientific data sources to produce a readable mutation story plus a 3D protein view.

The goal is not to replace domain experts.
The goal is to lower the friction for early-stage exploration so more people can follow the research path and understand what the tools are doing.

Live app: https://mutation-storyteller.vercel.app

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Tech

- Next.js (App Router)
- Vercel AI SDK
- Google Gemini tool calling
- AlphaFold DB + UniProt + PubMed + ClinVar
- 3Dmol.js for structure rendering

## Notes

- This is an active work in progress.
- It is a research explainer, not medical advice.
