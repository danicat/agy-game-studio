# Helper Scripts

This folder contains environment check and runtime launcher scripts for this repository.

## `check_env.sh`

Checks that your local machine has the tools needed to build Ebitengine WASM games, compile the Go MCP server, and run Game Dev Studio:

```bash
./scripts/check_env.sh
./scripts/check_env.sh --help
```

* **Required**: `go` (1.26+), `wasm_exec.js` (in `GOROOT`), and `node`.
* **Recommended (optional)**: [`godoctor`](https://github.com/danicat/godoctor) and [`kungfu`](https://github.com/danicat/kungfu).
* **Gemini / Vertex AI Auth (optional)**: Checks whether credentials are configured for the `image_generate` (Nano Banana) and `music_generate` (Lyria) MCP tools, either via Vertex AI / Gemini Enterprise (`GOOGLE_GENAI_USE_ENTERPRISE` or `GOOGLE_GENAI_USE_VERTEXAI` with `GOOGLE_CLOUD_PROJECT`) or via Gemini Developer API (`GEMINI_API_KEY` or `GOOGLE_API_KEY`). Optional checks emit `WARN` rather than `FAIL`, so `./scripts/check_env.sh` still exits `0` when all required tools pass.

## `run-mcp.mjs`

Compiles the unified 10-tool Go engine MCP server (`mcp/`) on demand when Go sources change and runs it over stdio JSON-RPC. Configured automatically via `mcp_config.json`.

In v0.4.0, duplicate per-skill `scripts/` directories inside `skills/` were removed in favor of this single Go MCP server. Removing those scripts eliminates Python and `uv` runtime dependencies across all 10 tools: procedural audio (`sound_presets`, `music_synthesize`, `music_validate`, `sfx_synthesize`), sprite processing (`sprite_inspect`, `sprite_compile`, `sprite_normalize`, `sprite_extract_palette`), and generative media (`image_generate`, `music_generate`).
