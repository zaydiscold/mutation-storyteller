# Modernization evidence, 2026-09-07

This records the implementation and verification on `improve/rosie-modernization`. PR #1 supplied the earlier reliability work and was merged before this pass. Local checks and pushed commits do not establish production deployment.

## Provider configuration and connection checks

`lib/providers.ts` resolves hosted requests to OpenRouter when `OPENROUTER_API_KEY` is nonempty, otherwise Gemini. The matching server model variable selects the model; UI model overrides do not change the hosted account's model. BYOK selects the user's provider, key and model instead. Neither hosted key is required to start the application or use reference previews.

Model settings offers overview and detailed reports. These set generation instructions rather than guaranteeing a fixed word count or scientific quality. `GET /api/providers` returns configuration presence and available free models, not credential validity. The catalog request uses a six-second deadline and one-hour revalidation; failure leaves the automatic free-router option available. Its menu includes up to 40 `:free` models advertising tool support and zero prompt/completion pricing.

`POST /api/providers` performs a real `generateText` call with a short connection-check prompt, 16 output tokens, no retries and a 20-second deadline. It sanitizes provider errors before returning them. Testing a connection can consume account quota or credits. Requests carry BYOK in headers through Rosie's server; the app stores no key in browser storage or a database. Refresh, changing provider and Clear key remove it from the UI's state. Questions and retrieved evidence go to the chosen model provider.

OpenRouter's automatic free router can choose different models across runs. A free model still requires an OpenRouter key and is subject to capacity, quotas and account restrictions. A custom model ID may incur charges. Consult the [OpenRouter FAQ](https://openrouter.ai/docs/faq) and [free-router guide](https://openrouter.ai/docs/cookbook/get-started/free-models-router-playground) for current terms. The model menu comes from [the model catalog](https://openrouter.ai/api/v1/models), not a hard-coded claim that any particular model will always be free.

Observed locally:

```text
Google models request, credential supplied via x-goog-api-key: HTTP 400
Rosie POST /api/providers: sanitized provider rejection observed
Valid local OpenRouter credential: unavailable
Successful live report generation: not verified
```

The local Google key was present but rejected. No credential value is included here. To reproduce with an authorized key, start the app, select the provider and model in Model settings, enter the key and click Test connection. Then submit a human variant query and inspect actual source records and report completion. These are separate checks: a short connection prompt does not verify tool calling or evidence quality. Do not record raw credentials or provider exceptions in findings.

## ClinVar field compatibility

A live ESummary request returned HTTP 200:

[ClinVar record 13420, ESummary JSON](https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=clinvar&id=13420&retmode=json)

```text
Observed classification fields:
germline_classification
clinical_impact_classification
oncogenicity_classification
```

Reproduce by opening that public JSON endpoint and inspecting the record under `result`. `lib/clinvar-record.ts` now prefers `germline_classification.description`, while accepting the older `clinical_significance.description` when necessary. Germline review status and last-evaluated date are preserved. Oncogenicity and clinical impact remain separate fields in the returned source record, rather than being treated as germline significance.

This avoids losing classifications when the upstream response uses its current field names. A search hit is still a candidate record, not verified variant/transcript identity. PubMed remains bibliographic metadata only; no abstracts or full text are retrieved in this pass.

## Pinned viewer distribution

The viewer loads a local 3Dmol.js 2.5.5 distribution, removing the runtime dependency on a moving CDN script:

- `public/vendor/3Dmol-2.5.5.min.js`: 537,792 bytes, downloaded with `curl --fail` from [3dmol 2.5.5 build](https://cdn.jsdelivr.net/npm/3dmol@2.5.5/build/3Dmol-min.js).
- `public/vendor/3Dmol-LICENSE`: downloaded with `curl --fail` from [the same version's license](https://cdn.jsdelivr.net/npm/3dmol@2.5.5/LICENSE).

Both upstream distributions are preserved byte-for-byte. `.gitattributes` disables whitespace checks for vendor assets to avoid rewriting upstream formatting. The distributed license identifies 3Dmol.js as BSD-3-Clause and retains incorporated GLmol, Three.js and jQuery notices. Keep these notices with any redistributed build. To reproduce the acquisition, download the two versioned URLs into temporary files and compare them with the checked-in artifacts.

The four bundled reference PDBs are actual structural data used in browser tests. They are reference predictions, not simulated mutant structures. The sequence fallback lists alpha-carbon residues present in the selected chain; it is not a claim that missing positions are absent from the biological protein. Confidence coloring describes reference prediction confidence, not mutation impact.

See [reliability notes](RELIABILITY.md) for the verified test results and their limits, and [the README](../README.md) for commands and setup.

## Production verification after merge

On 2026-09-07, PRs #1 and #2 were merged, with application release merge commit `188ff29b0b75e146bc8c1dff46c9230cca40b34c`. Both Vercel projects reported successful production builds.

- `GET https://mutation-storyteller.vercel.app/api/providers` returned HTTP 200, a configured hosted Google provider, and 15 free tool-capable OpenRouter models. No credentials were returned.
- `ROSIE_TEST_URL=https://mutation-storyteller.vercel.app npm run test:browser` passed all seven browser tests in 16.6 seconds. These exercised the public deployment, including all four real bundled PDB files. Report-generation tests still use explicitly labeled fixtures.
- `POST https://mutation-storyteller.vercel.app/api/providers` returned HTTP 502 with the sanitized message: “The provider rejected the key or request. Check your key and model in Model settings.” The hosted provider connection therefore remains unresolved; a successful live report is not verified.

The code and production UI are deployed. Supplying a valid provider credential and checking an actual generated report remains the acceptance step that cannot be completed with the currently configured credentials.
