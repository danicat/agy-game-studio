# Helper Scripts

This folder contains environment check and maintenance scripts for this repository.

## `check_env.sh`

Checks that your local machine has the tools needed to build Ebitengine games and generate Gemini assets:

```bash
./scripts/check_env.sh
```

* **Required**: `go` (1.26+), `wasm_exec.js` (in `GOROOT`), `node`, `uv`, `python3`, `file` (or `mimetype`), and Gemini credentials (`GEMINI_API_KEY` or Vertex AI ADC).
* **Recommended (optional)**: [`godoctor`](https://github.com/danicat/godoctor) and [`kungfu`](https://github.com/danicat/kungfu).

