---
name: godoctor
description: >
  Developer tooling and architectural safety rules for Go. Orchestrates
  standard Go toolchain and static analysis utilities (gofmt, goimports,
  go vet, modernize, golangci-lint, deadcode), guards edits with compiler
  rollback gates, finds test blind spots with Selene mutation testing, and
  runs fast test and coverage analytics with TestQuery SQLite queries.
  Activate when writing or refactoring Go code, verifying Ebitengine native
  and WebAssembly builds, fixing compilation or test failures, auditing test
  thoroughness, or enforcing idiomatic Go standards.
license: Apache-2.0
metadata:
  category: coding
  tags: "go, golang, testing, refactoring, quality, mutation-testing, ebitengine, wasm"
  author: Daniela Petruzalek (daniela@danicat.dev)
  version: "0.34.0"
  catalog: https://skills.danicat.dev
---

# Go Quality & Tooling Guide (GoDoctor)

GoDoctor coordinates standard Go toolchain binaries and static analysis utilities as both a command-line interface (CLI) and a Model Context Protocol (MCP) server. It provides guarded code edits with compiler rollback, automated build and lint pipelines, AST mutation testing, and SQLite test analytics.

---

## 1. Go Coding & Architectural Standards

### Google Go Style & Idiomatic Practices
- **Standard Toolchain Checks**: Format all code with `gofmt`, organize imports with `goimports`, check correctness with `go vet`, and lint with `golangci-lint`.
- **Naming Conventions**:
  - Do not repeat package names in exported types or functions (no stuttering). Write `user.Service` instead of `user.UserService`, `http.Server` instead of `http.HttpServer`, and `config.Load` instead of `config.LoadConfig`.
  - Use `camelCase` for unexported identifiers and `PascalCase` for exported identifiers. Keep acronyms uniform in case (such as `JSONURL`, `dbID`, `xmlHTTP`).
- **Error Handling**:
  - Return `error` as the final return value.
  - Wrap errors with context using `fmt.Errorf("loading sprite config: %w", err)`.
  - Never panic in libraries, game update loops, or standard logic. Return explicit errors instead.

### Package Architecture & Layout
- **Flat Package Structure**: Prefer flat package layouts grouped by feature or domain over deep layered folders (such as `adapters/`, `ports/`, `entities/`, `controllers/`, `repositories/`, `services/`, `usecases/`).
- **Private vs. Public API**: Put private packages inside `internal/` so external modules cannot import them. Avoid creating a `pkg/` directory.
- **Test Fixtures & Golden Files**: Store fixtures, golden files, and test inputs inside `testdata/` directories, which the Go toolchain ignores during normal builds.
- **Focused Files**: Split package logic into focused files named after their job (such as `server.go`, `handler.go`, `physics.go`, `types.go`) rather than a single monolithic file.
- **No Catch-All Packages**: Never create generic `util`, `shared`, `common`, or `helpers` packages. Put functions inside domain-specific packages or right next to where they are used.

### API, Service & Game Loop Design
- **Small Consumer Interfaces**: Keep interfaces small and define them where they are consumed (accept interfaces, return structs). Do not create single-implementation interfaces ahead of time.
- **Service Constructors**: Use explicit constructor injection (such as `NewServer(cfg, logger)`) and group HTTP routes and middleware cleanly on a server struct.
- **Hot-Path Discipline (Ebitengine)**: In 60 TPS game loops (`Update` and `Draw`), avoid per-frame heap allocations, reflection, and unbuffered channel stalls. Reuse pre-allocated slices and buffers.

---

## 2. Tool Selection Matrix

| Task / Goal | CLI Command (`godoctor call`) | MCP Tool Name / Aliases | Behavior & Safeguards |
| :--- | :--- | :--- | :--- |
| **Guarded Code Edits** | `godoctor call edit` | `edit`, `smart_edit` | Whitespace-insensitive matching, `goimports` formatting, atomic file write, and automatic rollback if `go vet` fails. |
| **Build & Quality Pipeline** | `godoctor call build` | `build`, `smart_build` | Runs `go mod tidy`, `modernize -fix`, `gofmt`, `go build`, `go test` with coverage, `golangci-lint`, and `deadcode`. |
| **Test & Benchmark Runner** | `godoctor call test` | `test`, `smart_test` | Multi-tier runner (`fast`, `basic`, `benchmark`, `complete`) coordinating `go test`, `go tool cover`, `testquery`, and `selene`. |
| **Package & Symbol Docs** | `godoctor call docs` | `docs`, `read_docs` | Reads package docs, exported symbols, types, and examples via `go list` and `go/doc` with return-type bundling. |
| **Mutation Testing** | `godoctor call selene` | `selene`, `mutation_test`, `mutation` | Runs the `selene` CLI with parallel workers and `testquery.db` targeted test selection. See [references/selene.md](references/selene.md). |
| **SQL Test Analytics** | `godoctor call tq` | `tq`, `test_query`, `testquery` | Runs SQLite queries against test history, statement coverage, and mutation results in `testquery.db`. See [references/testquery.md](references/testquery.md). |

### Test Runner Tiers (`godoctor call test`)
- **`level: "fast"`**: Sub-second inner loop. Runs `go test -v` directly and skips coverage profiling and `testquery.db` writes. Best for rapid edits and parallel worker checks.
- **`level: "basic"` (default)**: Standard check. Runs unit tests with statement coverage (`go tool cover -func`) and indexes results into `.godoctor/testquery.db`.
- **`level: "benchmark"`**: Runs Go benchmarks (`go test -bench=<pattern> -benchmem -run=NONE`) and prints throughput and memory allocations (`B/op`, `allocs/op`) as a Markdown table.
- **`level: "complete"`**: Full quality gate. Runs `basic` unit tests, coverage profiling, and `testquery.db` indexing, followed by multi-worker `selene` mutation testing. Use before releases or final sign-off.

---

## 3. Core Principles & Safeguards

- **Zero-Fallback Policy**: External binaries (`golangci-lint`, `modernize`, `deadcode`, `selene`, `testquery`) must be installed in `$PATH` or configured in `.godoctor.yaml`. Dynamic `go run` fallbacks are banned to avoid 1.5s to 4.5s startup delays and keep builds deterministic.
- **Tool Version Tracking**: Run `godoctor check` to inspect installed tool versions and health status against recommended baselines.
- **Absolute Paths Required**: Every directory (`dir`) and file (`filename`) parameter passed to `godoctor call` must be an absolute path.
- **Atomic Edit Transactions & Compiler Gate**: `edit` (`smart_edit`) matches target code blocks with whitespace-insensitive similarity, formats via `goimports`, and writes via an atomic temp-file rename. It then runs `go vet ./...` and rolls back the change (with identifier spelling suggestions) if compilation breaks.
- **Concurrency & Resource Management**: Full runs like `level: "complete"` (`selene` mutation testing) use all CPU cores and write to SQLite. Never launch concurrent build or mutation jobs on the same workspace at the same time.
- **Configuration Precedence**: Settings follow a three-tier order: per-call JSON payload overrides `.godoctor.yaml`, which overrides built-in defaults.

---

## 4. Integration with Game Studio & Multi-Agent Skills

`godoctor` acts as the optional Go quality control and verification gate across coding and game development workflows:

1. **With `vibe-game-developer` and `ebitengineer` (Native + WASM Verification)**:
   - Run `godoctor call build` and `godoctor call test` to verify native compilation, deterministic state machines, and zero-allocation hot paths (`level: "benchmark"`).
   - Whenever a project targets Ebitengine or browser playtesting in the Playtest tab in Game Dev Studio, always verify WebAssembly compilation alongside the native build:
     ```bash
     GOOS=js GOARCH=wasm go build -o /dev/null ./...
     ```
   - This catches platform-specific syscall imports, unsupported filesystem calls, or missing build tags (`//go:build js && wasm`) before opening the web preview.
2. **With `swarm-coding` and `parallel`**:
   - When multiple subagents edit distinct packages in parallel, each worker should use `godoctor call edit` for safe file updates and `godoctor call test` with `"level": "fast"` scoped to its target package.
   - Reserve workspace-wide `godoctor call build`, `level: "basic"`, and `level: "complete"` runs for the single coordinator agent after worker branches or changes merge. This prevents CPU contention and SQLite locks on `.godoctor/testquery.db`.

---

## 5. Environment Diagnostics & Configuration

### Check Installed Tools (`godoctor check`)
```bash
# Human-readable diagnostic table
godoctor check

# Machine-readable JSON output
godoctor check --json
```

### Initialize Configuration (`godoctor init`)
```bash
godoctor init
```

Example `.godoctor.yaml`:
```yaml
version: "1"

cli:
  default_output: "text"
  color: true

server:
  write_timeout: "5m"
  allowed_origins:
    - "http://localhost"
    - "http://localhost:*"
    - "http://127.0.0.1"
    - "http://127.0.0.1:*"

tools:
  golangci_lint:
    recommended_version: "v2.12.2"
    pkg: "github.com/golangci/golangci-lint/v2/cmd/golangci-lint@v2.12.2"
  modernize:
    recommended_version: "latest"
    pkg: "golang.org/x/tools/go/analysis/passes/modernize/cmd/modernize@latest"
  deadcode:
    recommended_version: "latest"
    pkg: "golang.org/x/tools/cmd/deadcode@latest"
  selene:
    recommended_version: "latest"
    pkg: "github.com/danicat/selene/cmd/selene@latest"
    workers: 0 # 0 defaults to runtime.GOMAXPROCS
    testquery_compat: true
  testquery:
    recommended_version: "latest"
    pkg: "github.com/danicat/testquery@latest"
    db_path: ".godoctor/testquery.db"

features:
  autofix: true
  deadcode_check: true
  testquery_sync: true
  version_check_hints: true
  auto_rollback: true
```

---

## 6. Installation & Surface Management

```bash
# Install or upgrade the godoctor CLI
go install github.com/danicat/godoctor/cmd/godoctor@latest

# Register MCP server and unpack skills globally (~/.gemini/config) or in workspace (-w)
godoctor install
godoctor install -w
godoctor install --mcp
godoctor install --skills

# Remove MCP registration and unpacked skills
godoctor uninstall
godoctor uninstall -w
```

---

## 7. Direct CLI Invocation Examples (`godoctor call`)

```bash
# 1. Guarded fuzzy edit with goimports and go vet rollback gate
godoctor call edit '{"filename": "/absolute/path/to/main.go", "old_content": "fmt.Println(\"old\")", "new_content": "fmt.Println(\"new\")"}'

# 2. Full build, test, lint, modernize, and deadcode check
godoctor call build '{"dir": "/absolute/path/to/project"}'
godoctor call build '{"dir": "/absolute/path/to/project", "packages": "./cmd/game", "output": "bin/game"}'

# 3. Multi-tier test runner (fast, basic, benchmark, complete)
godoctor call test '{"dir": "/absolute/path/to/project", "level": "basic"}'

# 4. Inspect package or symbol documentation via go/doc
godoctor call docs '{"import_path": "github.com/hajimehoshi/ebiten/v2", "symbol_name": "Game"}'

# 5. Run Selene AST mutation testing
godoctor call selene '{"dir": "/absolute/path/to/project"}'

# 6. Query test failures and coverage in SQLite via TestQuery
godoctor call tq '{"dir": "/absolute/path/to/project", "query": "SELECT package, test, elapsed FROM all_tests WHERE action = '\''fail'\''"}'
```

---

## 8. Companion References

- **TestQuery SQL Analytics & Schema**: [references/testquery.md](references/testquery.md) covers the SQLite schema (`all_tests`, `all_coverage`, `test_coverage`, `all_code`), predefined views, and query recipes for uncovering untested branches and slow tests.
- **Selene Mutation Testing Guide**: [references/selene.md](references/selene.md) covers AST mutation operators, mutant statuses (`KILLED`, `SURVIVED`, `UNCOVERED`), targeted execution with `testquery.db`, and how to fix surviving mutants and zero-kill tests.
