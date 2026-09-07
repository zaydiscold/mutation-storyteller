# Reliability and next work

## Changes in this pass

- Replace timer-driven source checkmarks with honest request/response status. Only the most recent user turn drives status and viewer selection.
- Keep a demo's URL, residue, chain and label together. Unknown queries never borrow an earlier answer's viewer configuration.
- Validate viewer metadata, restrict model downloads to the four bundled PDBs or direct AlphaFold HTTPS PDB URLs, and reject invalid residue/chain/label values.
- Reuse the 3D viewer across configuration updates; cancel stale downloads, stop spin on cleanup, bound library/download waits, display errors with retry, and place labels using the documented atom-selection argument.
- Verify that the requested residue exists before claiming a highlight. AlphaFold output is labeled as a reference prediction, not a simulated mutant or pathogenicity evidence.
- Add Stop, Retry and New conversation controls, accessible input/status labels, and guards against empty submissions. Preserve the archive styling, examples and radio mode; the shortcut does not intercept typing in editable fields.
- Validate HTTP JSON bodies and text-only user/assistant messages before starting a paid model request. System/tool/developer messages supplied by a caller are not accepted.
- Normalize the legacy client messages to model text messages rather than mixing incompatible UI-message shapes from different AI SDK generations.
- Forward abort signals and deadlines to model and source requests, check source HTTP responses, encode query parameters, and expose source URLs plus retrieval timestamps to the model.
- Use structured NDJSON events for the current client, carrying actual source calls/results and model metadata alongside report text. Retain the legacy text-stream response for callers without the events header. Error/abort events, missing terminal events, empty output and truncated completions remain incomplete.
- Keep source failures distinct from negative findings. Remind the model that PubMed titles are not full-text findings and reference structures do not establish mutation effects.

## Explicit limits

| Boundary | Limit |
| --- | --- |
| Request body actually read | 128 KiB |
| Conversation | 1–40 messages; final message must be a user |
| Each user / assistant message | 4,000 / 32,000 characters |
| Total conversation text | 64,000 characters |
| Generation and tool lifetime | 55 seconds within a 60-second route budget |
| Each source HTTP request | 10 seconds |
| Viewer library wait / total load | 10 / 20 seconds |

Abort propagation is best-effort cancellation, not a guarantee that a remote provider instantly stops billing. A response transport failure can surface as a generic browser network error; the interface offers retry without copying provider exceptions or credentials into the page.

Body-size validation is not authentication, a global concurrency cap, or a spending budget. Before unrestricted public use, enforce rate and cost limits at the hosting/provider boundary. This pass adds no database or auth framework. Do not submit private medical records to this public research prototype.

## Tests and verification

Verification on 2026-09-07 used Node.js 22 with installed dependencies:

- `npm test`: 38 offline regression tests passed against the actual helper modules. These cover current-turn isolation, viewer metadata, message/body limits, UTF-8 decoding, cancellation, source failures, provider selection/error sanitization, structured events and ClinVar field compatibility.
- `npm run test:browser`: seven Playwright browser tests passed in 19.8 seconds. All four actual bundled PDBs rendered with WebGL. Tests exercised viewer controls and PNG download, mobile width and input bounds, failed-download recovery, sequence fallback without WebGL, Stop and conversation reset, BYOK clearing on refresh, and report/source export.
- `npm run typecheck`, `npm run lint`, and `npm run build` passed. `npm audit` reported zero vulnerabilities at verification time.

The report rendering/export and failure tests use explicitly labeled provider fixtures. They verify application behavior, not scientific claims or successful live generation. Browser coverage uses local Chrome with software WebGL; it is not proof of every device, GPU or browser. CI runs unit, application and Chromium browser jobs; review its remote results separately.

The existing local Gemini credential was present but rejected by a live Google models request (HTTP 400). Rosie's connection check exposed a sanitized rejection. No valid OpenRouter credential was available locally, so successful live report generation remains unverified. ClinVar ESummary returned HTTP 200 with the current germline and separate somatic classification fields. See [exact checks and reproduction](MODERNIZATION.md).

## Next priorities

1. Verify a complete live report with an accepted provider credential, including tool calls, source records, model attribution and report export. A successful connection check alone does not prove tool compatibility or report quality.
2. Retrieve and validate abstracts before synthesizing study findings. Add citation-coverage and unsupported-claim evaluations.
3. Evaluate retrieved-text prompt injection and compare report quality across available tool-capable models. Free routing can change the selected model between requests.
4. Enforce hosting/provider rate and cost limits before unrestricted public hosted generation. Repeat dependency and deployment checks when shipping to production.
