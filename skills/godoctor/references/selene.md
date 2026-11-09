# Selene Mutation Testing Guide

[Selene](https://github.com/danicat/selene) tests the strength of Go unit test suites by introducing small syntactic changes (mutants) into the Abstract Syntax Tree (AST) and checking whether existing tests fail.

## Key Features & Safeguards

- **Zero-Fallback Binary Execution**: Selene runs directly from `$PATH` or as configured in `.godoctor.yaml`. Dynamic `go run` fallbacks are banned to avoid compilation delays.
- **Targeted Fast Mode**: Reads statement coverage from TestQuery (`testquery.db`) so each mutant only runs the specific unit tests that cover the modified line.
- **In-Memory Overlay Builds**: Uses Go's `-overlay` flag to compile mutated code without modifying files on disk.
- **Safety Exclusions**: Automatically skips dangerous calls (`os.RemoveAll`, `exec.Command`, `syscall.*`) and their surrounding conditional checks.
- **Parallel Worker Pool**: Evaluates mutants across worker processes (`-workers N`) with strict per-mutant timeouts.
- **Test Effectiveness Scoring**: Tracks which tests kill mutants and flags tests that execute covered code without catching any defects (zero-kill tests).

---

## Mutant Status Reference

| Status | Meaning | Action |
| :--- | :--- | :--- |
| `KILLED` | A test caught the mutation and failed. | None. The test suite caught the bug. |
| `SURVIVED` | All tests passed despite the mutated logic. | Add assertions covering the mutated condition, return value, or boundary. |
| `UNCOVERED` | No test executed the mutated line. | Add a unit test for this code path. |
| `TIMEOUT` | The mutation caused an infinite loop or hang. | Treated as killed. |
| `EXCLUDED` | Skipped automatically by the safety guard. | None. |

---

## Installation & Verification

Check whether `selene` is installed and healthy:
```bash
godoctor check
```

Install or upgrade `selene` with the Go toolchain:
```bash
go install github.com/danicat/selene/cmd/selene@latest
```

---

## Configuration in `.godoctor.yaml`

```yaml
tools:
  selene:
    command: "selene"
    recommended_version: "latest"
    pkg: "github.com/danicat/selene/cmd/selene@latest"
    timeout: "3m"
    workers: 0                    # 0 defaults to runtime.GOMAXPROCS
    testquery_compat: true        # Use testquery.db for targeted test selection
    db_path: ".godoctor/testquery.db"
    disabled: false

features:
  mutation_testing: true
  testquery_sync: true
```

---

## Running Selene

### 1. Via GoDoctor CLI (Recommended)
```bash
# Run mutation testing directly on a workspace
godoctor call selene '{"dir": "/absolute/path/to/project"}'

# Run the complete test pipeline (unit tests + coverage + Selene mutation testing)
godoctor call test '{"dir": "/absolute/path/to/project", "level": "complete"}'
```

### 2. Standalone CLI Execution
```bash
# Build the coverage database first, then run targeted mutation tests
tq build ./...
selene --db .godoctor/testquery.db -workers 8 -v ./...

# Run untargeted mutation tests across all packages
selene -workers 8 ./...

# Emit machine-readable JSON for CI checks
selene --db .godoctor/testquery.db -json ./...
```

---

## Querying Mutation Results in `testquery.db`

Selene writes results to the `selene` and `selene_tests` tables inside `.godoctor/testquery.db` (status values are stored in lowercase: `'killed'`, `'survived'`, `'uncovered'`, `'timeout'`, `'excluded'`). Query them using `godoctor call tq`:

### 1. List Surviving Mutants (Assertion Gaps)
```sql
SELECT id, mutator, file, line, col
FROM selene_survived
ORDER BY file, line;
```

### 2. Kill Rate by Mutator Type
```sql
SELECT mutator,
       COUNT(*) AS total,
       SUM(CASE WHEN status = 'killed' THEN 1 ELSE 0 END) AS killed,
       SUM(CASE WHEN status = 'survived' THEN 1 ELSE 0 END) AS survived,
       SUM(CASE WHEN status = 'uncovered' THEN 1 ELSE 0 END) AS uncovered,
       SUM(CASE WHEN status = 'timeout' THEN 1 ELSE 0 END) AS timeouts
FROM selene
GROUP BY mutator
ORDER BY total DESC;
```

### 3. Find Zero-Kill Tests
```sql
SELECT test_name, package
FROM selene_zero_kill_tests;
```

### 4. Inspect Safety-Excluded Mutants
```sql
SELECT id, mutator, file, line, col, reason
FROM selene_excluded;
```

### 5. Overall Mutation Score Summary
```sql
SELECT * FROM selene_summary;
```

### 6. Top 10 Tests by Mutants Killed
```sql
SELECT test_name, package, mutations_killed, killed_mutant_ids
FROM selene_tests
WHERE mutations_killed > 0
ORDER BY mutations_killed DESC
LIMIT 10;
```

---

## Fixing Zero-Kill Tests

A zero-kill test runs during mutation testing but never fails when the underlying code is mutated.

| Cause | Typical Pattern | Fix |
| :--- | :--- | :--- |
| **Shallow Assertions** | Only checks `err == nil` or non-nil struct pointer. | Assert exact output fields, state transitions, or return values. |
| **Duplicate Subtest** | Table row tests the exact same branch as an earlier row. | Merge duplicate cases or adjust inputs to hit distinct boundaries. |
| **Trivial Getter Check** | Tests a simple constructor or getter with no branching logic. | Fold the check into a behavioral test and remove the standalone test. |
| **Early-Return Guard** | Passes empty input that triggers an immediate return. | Keep if verifying a public contract; otherwise merge into a table test. |

---

## Fixing Surviving Mutants

### 1. Boundary Mutants (`>=` changed to `>`)
Add test cases right on the boundary value, plus one step below and above:
```go
tests := []struct {
	name     string
	val      int
	expected bool
}{
	{name: "below threshold", val: 17, expected: false},
	{name: "at threshold", val: 18, expected: true},
	{name: "above threshold", val: 19, expected: true},
}
```

### 2. Return Value Mutants (`return token, nil` changed to `return "", nil`)
Check the returned payload in addition to `err == nil`:
```go
res, err := GenerateToken("user123")
if err != nil {
	t.Fatalf("unexpected error: %v", err)
}
if res == "" {
	t.Errorf("expected non-empty token")
}
```

### 3. Inverted Conditionals (`if ok` changed to `if !ok`)
Ensure tests exercise both the `true` and `false` branches and verify the side effects of each branch.

---

## Practical Tips

- **Use `fast` for Inner Loops**: Run `level: "fast"` while iterating on code or running parallel subagents. Save `level: "complete"` or standalone `selene` runs for final verification.
- **Avoid Concurrent Runs**: Selene uses all CPU cores (`-workers N`). Do not run other builds or tests in parallel while mutation testing is active.
- **Green Baseline First**: Fix all failing unit tests before running Selene.
- **Refresh Coverage Before Targeted Runs**: Run `godoctor call test` (`level: "basic"`) first so `.godoctor/testquery.db` reflects your latest code lines.
