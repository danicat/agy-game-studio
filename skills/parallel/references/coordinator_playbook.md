# Coordinator Playbook and Operational Protocols

This guide describes the step-by-step protocol for the root Coordinator agent running under the `/parallel` skill.

---

## 1. The Coordinator Mandate

The root Coordinator plans the work, dispatches workers, and combines their outputs.

> [!IMPORTANT]
> **Three Core Rules for the Parallel Coordinator:**
> 1. **Yield Right Away (Hard Rule)**: Stop calling tools right after launching workers so the main chat session stays unblocked and responsive.
> 2. **Delegate Execution**: Do not write large production code, run full benchmark sweeps, generate assets, or perform deep web crawls in the root session. Subagents do the execution; the Coordinator plans, tracks, and synthesizes.
> 3. **Sole User Interface**: Subagents do not have the `ask_question` tool. Route all user clarifications through the Coordinator.

---

## 2. Invocation Parsing and Budget Calculation

When the user invokes `/parallel`, determine the concurrency budget (`DOP`) and phase structure:

```
+--------------------------------------------------------------------------+
|                       BUDGET RESOLUTION RULES                            |
|                                                                          |
|  Expression                              Calculated DOP / Action         |
|  ----------------------------------------------------------------------  |
|  /parallel 6                             DOP = 6                         |
|  /parallel dop: 8                        DOP = 8                         |
|  /parallel budget 4                      DOP = 4                         |
|  /parallel 3 planning, 8 execution       Phase 1: DOP = 3; Phase 2: 8    |
|  /parallel (no number provided)          Default DOP = 5 (or 10 if large)|
|  /parallel 1 (minimum budget)            DOP = 1 (spawns 1 worker        |
|                                          to keep main session unblocked) |
+--------------------------------------------------------------------------+
```

### Budget Usage Rules:
- Use the full allocated budget whenever enough independent tasks exist.
- Always launch at least **1 subagent**. Even with `DOP = 1`, dispatch the task to a worker and end your turn so the user can still chat with the root session.

---

## 3. Subagent Dispatch Standards

Launch each active worker with its own `invoke_subagent` call in the same turn:

```json
{
  "TypeName": "self",
  "Role": "Physics Package Engineer",
  "Prompt": "Implement internal/physics against SPECS.md using godoctor and ebitengineer. Write verification logs to staging/worker_physics.md and report back via send_message.",
  "Model": "inherit",
  "Workspace": "inherit"
}
```

### Subagent Configuration Rules:
1. **Model Selection**: Set `Model: "inherit"` by default so the worker uses the parent session's model and configuration. Use `"flash"`, `"flash_lite"`, or `"pro"` only when requested.
2. **Workspace Mode**:
   - Use `"inherit"` (default) when workers own strictly separate directories or files (such as `internal/physics/`, `assets/sprites/player.sprite`, or `staging/chunk_1.md`).
   - Use `"branch"` or `"share"` when racing multiple workers on the same codebase files so their edits never collide.
3. **Skill Activation in Worker Prompts**: Name the domain skills each worker should load for its task:
   - Go and Ebitengine packages: instruct workers to load `godoctor` and `ebitengineer`.
   - Visual assets: instruct workers to load `sprite-design`.
   - Audio assets: instruct workers to load `procedural-music`, `procedural-sfx`, or `lyria`.
   - Architecture and game loops: reference the `SPECS.md` contract defined via `swarm-coding` or `vibe-game-developer`.
4. **Two-Tier Output Contract**: Every worker prompt must instruct the subagent to:
   - Complete its assigned slice and write full outputs, code, assets, or logs directly to disk (such as `staging/worker_<id>.md`).
   - Send a short completion report (under 2,000 characters) via `send_message` to the parent containing:
     - Status (`pass`, `fail`, or `blocked`).
     - File paths created or modified on disk.
     - A short bullet list of key findings, interface notes, and potential blockers.
5. **No Sibling Messaging**: Workers never message other workers; they report only to the parent Coordinator.

---

## 4. The Dispatch-and-Yield Step

After calling `invoke_subagent` for all active slots, follow this exact sequence:

```
[ Call invoke_subagent for Workers 1..N ]
                   |
                   v
[ Send a brief acknowledgment to the user ]
  "Dispatched N parallel workers. Standing by for results..."
                   |
                   v
[ STOP CALLING TOOLS IMMEDIATELY ]
  (Turn ends. Main session is completely unblocked.)
```

### Never Do This:
- Never call `sleep` or set timers just to poll workers.
- Never call `manage_subagents(Action="list")` in a loop waiting for completion.
- The messaging system wakes the Coordinator automatically whenever a worker calls `send_message`.

---

## 5. Reactive Event Handling

While workers run in the background, the Coordinator wakes up on three types of events:

### Event A: Worker Completion Message
1. Read the worker's summary and verify its output file path.
2. Mark that subtask done in your tracking list.
3. If queued tasks remain (`Tasks > DOP`), launch a fresh worker right away to fill the open slot and yield the turn.
4. Once all tasks in the current phase finish, run the **Reduce** step (or start the next phase in a multi-phase run).

### Event B: User In-Flight Message or Steering
Because the main session stays unblocked, the user can message you while workers are running:

1. **Status Check ("How is it going?")**:
   - Call `manage_subagents(Action="list")` to check active workers.
   - Give the user a short status update and end your turn.
2. **Scope Change ("Focus on Y instead" or "Add constraint Z")**:
   - Message active workers with `send_message` or update the queued task list.
   - If a running worker's task is no longer needed, stop it with `manage_subagents(Action="kill", ConversationIds=[...])`.
3. **Stop All Work ("Cancel this")**:
   - Call `manage_subagents(Action="kill_all")`.
   - Confirm cancellation to the user and end your turn.

### Event C: Worker Escalation or Question
If a worker runs into an ambiguous requirement:
1. The worker sends a question to the Coordinator via `send_message`.
2. If the Coordinator can answer from existing specs (`SPECS.md`), it replies directly via `send_message`.
3. If user input is required, the Coordinator calls `ask_question`, waits for the user's choice, and forwards the answer to the worker via `send_message`.

---

## 6. The Reduce and Delivery Protocol

When all workers finish:

1. **Check Deliverables**: Confirm all expected files exist on disk with no leftover `TODO`, `FIXME`, or stub code.
2. **Review Key Takeaways**: Check every worker's interface notes and edge-case warnings so nothing gets lost during integration.
3. **Merge and Wire**: Combine staged sections, wire Go packages and game assets into the application entry point, or build the comparison table.
4. **Verify**: Run builds, tests, and linters (such as `go test ./...` or `godoctor` checks).
5. **Deliver**: Present the finished result to the user with a concise summary of how many workers ran, what tasks completed, and what verification checks passed.
