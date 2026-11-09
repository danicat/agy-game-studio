# Agent Racing and Tournament Guide

This guide covers the main exception to non-overlapping task slicing: **Agent Racing and Tournaments**.

While standard parallel execution splits a project into separate pieces, **Racing** assigns multiple subagents to the *same* problem (or distinct variations of it) to compare alternatives, explore creative options, and pick or combine the strongest solution.

---

## 1. When to Race Agents

Standard partitioning avoids duplicate work. Racing intentionally spends parallel budget on competing solutions when exploring multiple paths pays off.

```
        DISJOINT PARTITIONING                      RACING / TOURNAMENT
        (Separate Work Units)                    (Competing Alternatives)

             Coordinator                                 Coordinator
            /     |     \                               /     |     \
           v      v      v                             v      v      v
       Task A   Task B  Task C                     Candidate Candidate Candidate
         |        |      |                            1         2         3
         +--------+------+                             \        |        /
                  |                                     v       v       v
                  v                                  +---------------------+
               Reduce                                |  Judge / Selection  |
           (Integration)                             |  Best-of-N / Merge  |
                                                     +---------------------+
                                                                |
                                                                v
                                                         Winning Deliverable
```

### Best Use Cases for Racing:
1. **High-Impact Architecture Decisions**: Multiple valid designs exist with different trade-offs (such as ECS vs. typed struct slices in Ebitengine, or event-driven vs. polling pipelines).
2. **Hard Optimization or Bug Hunting**: Subtle race conditions, zero-allocation hot-loop bottlenecks, or tricky physics edge cases where independent search paths find the fix faster.
3. **Creative Game Asset and Audio Tournaments**: Generating 3 to 4 competing character sprites (`sprite-design`), boss music themes (`procedural-music` or `lyria`), or weapon sound effects (`procedural-sfx`) so the Coordinator or user can pick the best fit.
4. **Adversarial Security and Quality Audits**: Independent reviewers inspect the same codebase from different angles to catch bugs a single reviewer might miss.

---

## 2. Four Racing Patterns

### Pattern 1: Identical Prompt Racing
Runs `N` subagents with the exact same prompt and constraints.
- **How It Works**: Uses natural variation in model exploration and search paths.
- **Best For**: Bug hunting, tricky algorithms, and creative brainstorming.
- **How to Pick the Winner**: Select the first candidate that passes all tests and benchmarks with clean, readable code.

### Pattern 2: Constrained Angle Racing
Runs `N` subagents on the same goal, giving each worker a distinct design constraint or aesthetic direction.
- **Example A: Go Backend Service (`DOP = 3`)**:
  - Worker 1: Optimize for raw write throughput and minimal allocations.
  - Worker 2: Optimize for strict transactional safety and simple recovery.
  - Worker 3: Optimize for small code footprint and easy maintenance.
- **Example B: Game Boss Theme (`DOP = 3` with `procedural-music`)**:
  - Worker 1: Fast 160 BPM FM-synth metal groove in D Dorian.
  - Worker 2: Orchestral gothic organ and strings in C harmonic minor.
  - Worker 3: Syncopated 7/8 chiptune pulse in E Phrygian Dominant.
- **How to Pick the Winner**: Compare candidates in a side-by-side trade-off table or let the user audition the staged files.

### Pattern 3: Adversarial Red-Blue Racing
Assigns workers opposing roles to stress-test a design or codebase.
- **Example: Codebase Hardening (`DOP = 4`)**:
  - Worker 1 (Architect): Documents safety invariants and state transitions.
  - Worker 2 (Breaker): Writes edge-case fuzz inputs and concurrency stress tests to break invariants.
  - Worker 3 (Performance Auditor): Profiles allocations and frame-time spikes (`ebitengineer`, `godoctor`).
  - Worker 4 (Verifier): Checks error handling and boundary conditions.
- **How to Pick the Winner**: Test Worker 2's reproduction cases against Worker 1's invariants and apply fixes for every verified failure.

### Pattern 4: Multi-Round Tournament Brackets
Runs a multi-stage bracket for major features or prototypes:
- **Round 1 (Diverge)**: Launch 4 to 8 workers in isolated workspaces (`Workspace: "branch"` or `"share"`) or staging folders to build independent prototypes.
- **Round 2 (Score and Prune)**: Run tests and benchmarks on every prototype and pick the top 2 finalists.
- **Round 3 (Merge and Polish)**: Combine the strongest ideas from the finalists into the production codebase.

---

## 3. Selecting or Merging the Winner

Once all racing workers finish, use one of three ways to converge on a final output:

```
+-------------------------------------------------------------------------+
|                        CONVERGENCE MECHANISMS                           |
|                                                                         |
|  1. Best-of-N (Winner Take All)                                         |
|     Candidate 1  [Score: 78]                                            |
|     Candidate 2  [Score: 94]  ===>  WINNER: Candidate 2 Selected        |
|     Candidate 3  [Score: 82]                                            |
|                                                                         |
|  2. Hybrid Synthesis (Cherry-Pick & Merge)                              |
|     Candidate 1: Zero-alloc spatial grid     \                          |
|     Candidate 2: Cleanest collision API       ===>  Unified Synthesis   |
|     Candidate 3: Thorough edge-case tests    /                          |
|                                                                         |
|  3. Consensus & Majority Voting                                         |
|     Worker 1: "Critical race condition in pool.go"                      |
|     Worker 2: "Critical race condition in pool.go" ===> Verified Issue  |
|     Worker 3: "Minor style warning"                                     |
+-------------------------------------------------------------------------+
```

### 1. Best-of-N Selection (Winner Take All)
Score each candidate against a clear rubric:
- **Correctness**: Does it compile cleanly and pass all tests (`go test ./...`, `godoctor`, or asset validation)?
- **Performance**: How fast does it run, and does it avoid hot-loop allocations?
- **Clarity**: Is the code or asset DSL clean and easy to maintain?
Promote the winning candidate to the main workspace path and remove the unused staging files.

### 2. Hybrid Synthesis (Cherry-Pick and Combine)
Review all candidates and combine their strongest parts into a single solution:
- Take the zero-allocation data structure from Candidate 1.
- Take the clean public API from Candidate 2.
- Take the table-driven test suite from Candidate 3.

### 3. Consensus Voting
For audits, code reviews, and fact-checking:
- Findings flagged independently by 2 or more workers are promoted to high-confidence action items.
- Single-worker findings are verified by the Coordinator before inclusion.

---

## 4. Step-by-Step Playbook for Racing

1. **Define Fixed Rules vs. Open Choices**:
   - Specify what every candidate must match (such as exported Go function signatures, sprite dimensions, or audio duration).
   - Specify what each candidate is free to vary (algorithms, data layouts, visual palettes, or musical arrangements).
2. **Isolate Worker Outputs**:
   - Have each candidate write to its own staging path (`staging/candidate_1/`, `staging/candidate_2/`) or run in an isolated workspace (`Workspace: "branch"` or `"share"`) so workers never overwrite one another.
3. **Dispatch and Yield**:
   - Launch all `N` candidates with `invoke_subagent` and end your turn right away.
4. **Score and Deliver**:
   - When all candidates report back, run verification checks, summarize the comparison table, and apply or present the winning output.

---

## 5. Comparison Table Template

Use a clear markdown table when presenting race results to the user:

```markdown
### Parallel Race Results (Budget: 3 Workers)

| Criterion | Candidate 1 (Spatial Hash) | Candidate 2 (Flat Quadtree) | Candidate 3 (Sweep and Prune) |
| :--- | :--- | :--- | :--- |
| **Throughput (10k entities)** | 0.42 ms/frame | 0.68 ms/frame | 0.51 ms/frame |
| **Allocs / Op** | 0 allocs/op | 0 allocs/op | 1 alloc/op |
| **Code Size** | 165 lines | 290 lines | 210 lines |
| **Test Suite** | Pass (`go test -race`) | Pass (`go test -race`) | Pass (`go test -race`) |

**Verdict**: Selected Candidate 1 for the lowest frame time and zero allocations per frame.
```
