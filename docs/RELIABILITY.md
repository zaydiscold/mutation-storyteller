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
- Preserve the existing text-stream client protocol. Error/abort events, missing terminal events, empty output and truncated completions reject the response rather than silently looking successful.
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

`npm test` executes 30 regression tests against the real helper modules, with fake source responses and model-event iterators. It covers current-turn isolation, honest progress, viewer metadata, safe URL boundaries, message/body limits, multibyte UTF-8 decoding, stream failures/truncation/cancellation, and source HTTP/cancellation behavior.

These are not browser, WebGL or live-provider tests. The local editing environment lacked network access and installed application dependencies, so the full Next.js typecheck/build and browser flow were not run there. Helper modules were independently checked with TypeScript; UI/route files were syntax-checked. CI is configured to run the full application checks, but its actual result must be reviewed separately.

Before merging, verify all four bundled examples, a new query after a prior answer, follow-up text, Stop and Retry, a missing API key, provider failure, blocked 3Dmol CDN, missing PDB, and rapid changes of viewer configuration in a real browser.

## Next priorities

1. Align the client/server AI SDK generations in a separately tested migration and use structured, source-level progress events instead of the temporary request-level status.
2. Render a source/evidence panel from validated tool results, not model-written assertions. Include retrieval time, record identifiers, actual evidence scope and explicit conflicts.
3. Retrieve and validate abstracts before synthesizing study findings. Add citation-coverage and unsupported-claim evaluations.
4. Add browser tests for streaming, failures, WebGL cleanup and mobile layout. Pin and test a supported 3Dmol release rather than relying on the moving CDN build.
5. Evaluate retrieved-text prompt injection and provider-model availability. Check dependency advisories in a network-enabled environment before public deployment.
