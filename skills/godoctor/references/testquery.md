# TestQuery SQL Test Analytics Guide

[TestQuery](https://github.com/danicat/testquery) indexes Go test execution logs, statement coverage, and mutation test outcomes into a local SQLite database (`.godoctor/testquery.db`). You can query this database with standard SQL to spot failing tests, uncovered lines, and slow test suites in milliseconds.

## Key Features & Safeguards

- **Zero-Fallback Binary Execution**: TestQuery runs directly from `$PATH` or as configured in `.godoctor.yaml`. Dynamic `go run` compilation fallbacks are disabled.
- **Concurrent SQLite Storage**: Stores metrics in `.godoctor/testquery.db` using SQLite WAL mode for fast concurrent reads.
- **Auto-Indexing**: Running `godoctor call test` at `level: "basic"` or `level: "complete"` automatically updates `.godoctor/testquery.db`. If the database does not exist when you run `godoctor call tq`, GoDoctor builds it first.

---

## Database Schema Reference

| Table | Purpose | Key Columns |
| :--- | :--- | :--- |
| `all_tests` | Test outcomes, durations, and log lines. | `time`, `action` (`pass`/`fail`), `package`, `test`, `elapsed`, `output` |
| `all_coverage` | Statement execution counts per block. | `package`, `file`, `function_name`, `start_line`, `end_line`, `stmt_num`, `count` |
| `test_coverage` | Mapping of individual tests to covered statement blocks. | `test_name`, `package`, `file`, `start_line`, `end_line`, `stmt_num`, `count` |
| `all_code` | Indexed source code lines for joining against coverage. | `package`, `file`, `line_number`, `content` |
| `selene` | AST mutation records and evaluation outcomes. | `id`, `mutator`, `file`, `line`, `col`, `status` (`'killed'`, `'survived'`, `'uncovered'`, `'timeout'`, `'excluded'`), `killed_by` |
| `selene_tests` | Per-test mutation kill counts and IDs. | `test_name`, `package`, `status`, `mutations_killed`, `killed_mutant_ids` |

### Predefined Views
- `failed_tests`: All failed test cases with elapsed time.
- `passed_tests`: All passing test cases.
- `missing_coverage`: Statement blocks with zero executions (`count = 0`).
- `code_coverage`: Statement coverage percentage grouped by package and file.
- `selene_survived`: Mutants that survived all tests.
- `selene_zero_kill_tests`: Tests that ran without killing any mutants.
- `selene_summary`: Overall mutation testing totals and score.
- `selene_excluded`: Mutants skipped by safety rules.

---

## Installation & Configuration

Check whether `testquery` is installed:
```bash
godoctor check
```

Install or upgrade `testquery`:
```bash
go install github.com/danicat/testquery@latest
```

Configuration in `.godoctor.yaml`:
```yaml
tools:
  testquery:
    command: "testquery"
    recommended_version: "latest"
    pkg: "github.com/danicat/testquery@latest"
    db_path: ".godoctor/testquery.db"
    timeout: "2m"
    disabled: false

features:
  testquery_sync: true
```

---

## Running SQL Queries

### 1. Via GoDoctor CLI (`godoctor call tq`)
Always pass an absolute directory path for `dir`:
```bash
godoctor call tq '{"dir": "/absolute/path/to/project", "query": "SELECT package, test, elapsed FROM all_tests WHERE action = '\''fail'\''"}'
```

### 2. Via MCP Tool (`tq` or `test_query`)
```json
{
  "dir": "/absolute/path/to/project",
  "query": "SELECT package, test, elapsed FROM all_tests WHERE action = 'fail';"
}
```

### 3. Via Standalone CLI
```bash
testquery query --db .godoctor/testquery.db "SELECT * FROM all_tests WHERE action = 'fail'"
```

---

## Common SQL Query Recipes

### 1. Recent Test Failures and Output Logs
```sql
SELECT package, test, elapsed, output
FROM all_tests
WHERE action = 'fail'
ORDER BY time DESC;
```

### 2. Packages Ranked by Lowest Statement Coverage
```sql
SELECT
    package,
    SUM(CASE WHEN count > 0 THEN stmt_num ELSE 0 END) AS covered_stmts,
    SUM(stmt_num) AS total_stmts,
    ROUND(100.0 * SUM(CASE WHEN count > 0 THEN stmt_num ELSE 0 END) / SUM(stmt_num), 2) AS coverage_pct
FROM all_coverage
GROUP BY package
ORDER BY coverage_pct ASC;
```

### 3. Uncovered Blocks in a Specific Package
```sql
SELECT file, function_name, start_line, end_line, stmt_num
FROM all_coverage
WHERE count = 0 AND package LIKE '%physics%'
ORDER BY file, start_line;
```

### 4. Exact Source Lines of Uncovered Code
```sql
SELECT c.file, c.line_number, c.content
FROM all_code c
JOIN all_coverage cov
  ON c.file = cov.file
 AND c.line_number BETWEEN cov.start_line AND cov.end_line
WHERE cov.count = 0
ORDER BY c.file, c.line_number;
```

### 5. Slowest Passing Tests (> 0.25s)
```sql
SELECT package, test, elapsed
FROM all_tests
WHERE action = 'pass' AND elapsed > 0.25
ORDER BY elapsed DESC;
```

### 6. Statement Coverage Inside a Specific Function
```sql
SELECT file, start_line, end_line, count
FROM all_coverage
WHERE function_name = 'StepPhysics'
ORDER BY start_line;
```

---

## Practical Tips

- **Single Quotes in SQLite**: Always wrap SQL string literals in single quotes (`'fail'`, `'killed'`). When passing JSON inside a single-quoted shell command, escape single quotes as `'\''`.
- **Parallel Worker Safety**: During multi-agent or parallel runs, let individual workers run `godoctor call test` with `"level": "fast"` (which skips SQLite writes) and run `level: "basic"` once after merging to avoid SQLite write contention.
