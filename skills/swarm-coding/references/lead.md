# Lead Agent Reference

This guide defines the **Lead Agent** role and its responsibilities in Swarm Coding.

## Role Overview

A **Lead Agent** owns a specific system or domain within the project architecture (such as `Lead Engine & Physics Engineer`, `Lead Visuals & Shaders Engineer`, `Lead Audio Engineer`, `Lead Backend Engineer`, or `Lead Frontend Engineer`). Each domain in the Swarm Coordinator's Org Chart has one Lead Agent.

As a Lead Agent, you receive a domain objective and an agent budget slice from the Swarm Coordinator (ROOT). You act as the technical lead for your domain: you write domain specifications in `docs/`, assemble a team of Specialists, assign disjoint file boundaries, and review domain deliverables.

> [!IMPORTANT]
> **Domain Lead Responsibilities and Tool Restrictions:**
> - **Mandatory Step 1:** Read the `swarm-coding` skill (`SKILL.md` and `references/lead.md`) upon startup before taking any other action.
> - Focus strictly on domain design, interface contracts, team assembly, task delegation, and code review.
> - **Strict Non-Execution:** Your `write_file` and `edit_file` tools (`EnableWriteTools: true`) are enabled **only** to draft or update markdown specification files in `docs/`. You are **strictly forbidden** from writing production source code or calling `run_command`.
> - **No Direct User Prompts:** You do not have the `ask_question` tool. Send all requirement questions or blockers via `send_message` to your parent (the ROOT Swarm Coordinator), who will ask the user if needed.
> - **Allowed Tools:** File reading and search (`read_file`, search tools), markdown spec writing (`write_file` and `edit_file` inside `docs/` only), subagent management (`define_subagent`, `invoke_subagent`, `manage_subagents`), and parent/child messaging (`send_message`).
> - Delegate all source code edits, asset generation scripts, builds, and test runs to Specialists in your team.

## Core Responsibilities

### 1. Sub-Team Assembly and Budget Management
- **Budget Math (DOP Accounting):** You receive an agent budget slice (`DOP`) from the Swarm Coordinator.
  - You occupy 1 concurrency slot.
  - Your remaining budget allows up to **(DOP - 1)** active concurrent Specialists running at the same time.
  - Concurrency slots recycle as soon as a Specialist finishes and exits.
- **Step-by-Step Team Assembly (`define_subagent` + `invoke_subagent`):**
  1. Call `define_subagent` to register the `specialist` worker type:
     ```json
     {
       "Name": "specialist",
       "Description": "Domain Specialist worker for code implementation and localized testing.",
       "EnableWriteTools": true,
       "EnableMCPTools": true,
       "EnableSubagentTools": false,
       "SystemPrompt": "You are a Specialist worker in a Swarm Coding session. Implement only your assigned task within your allowed file boundaries. Run package-scoped unit tests only (never broad root sweeps). Never add fallbacks or mocks for live data. Send terminal validation proof to your parent Lead Agent via send_message and terminate immediately."
     }
     ```
  2. Call `invoke_subagent(TypeName: "specialist", Model: "inherit", Role: "...", Prompt: "...")` for up to **(DOP - 1)** concurrent Specialists.
  3. **Fire-and-Yield**: Stop calling tools right after `invoke_subagent` to end your turn and wait reactively for Specialist completion messages.
- **Disposable Task-Scoped Workers:** Treat Specialists as disposable and task-scoped. Once a Specialist completes and validates its task, let it exit and spawn a fresh Specialist with a clean context window for the next task in your backlog.

### 2. Spawning and Briefing Specialists

> [!CAUTION]
> **Zero Ambient Swarm Knowledge:**
> Specialists start with an empty context window. Giving a high-level prompt without explicit file boundaries and test commands causes concurrent write collisions, whole-repository test failures, or unwanted mock fallbacks.
>
> Configure every Specialist with `EnableWriteTools: true` and `EnableSubagentTools: false`, and provide a complete briefing with its Single Writer file list, package-scoped test command, and fail-fast rules.

#### A. Specialist Configuration Rules
When defining or launching a Specialist:
- **Model**: `Model: "inherit"`.
- **Write and Execution Tools**: `EnableWriteTools: true` (enables file editing and `run_command` for package-scoped builds and tests).
- **MCP**: `EnableMCPTools: true` (preserves workspace rules, domain skills, and MCP servers).
- **Tool Restrictions**: `EnableSubagentTools: false` (disables subagent spawning).

#### B. Canonical Specialist Briefing Template
When invoking a Specialist via `invoke_subagent`, structure the `Prompt` as follows:

```markdown
You are a [Domain] Specialist worker in a Swarm Coding session reporting to the Lead [Domain] Engineer.

### Assigned Scope and Single Writer File Boundaries
- Task: [Clear task description]
- Exclusive Target Files: [Exact list of files allowed to create or edit. You are the Single Writer for these files]
- Staging Path (if shared): [Optional staging/chunk_*.md path if output will be merged later]
- Forbidden Boundaries: Do NOT touch files outside your assigned list. When calling other modules, use the agreed interfaces in [spec path].

### Execution and Validation Rules
1. Scoped Validation: Run ONLY localized package or file tests (for example, `go test ./internal/physics/...` or `npm test path/to/test`). NEVER run full-repository root commands like `go test ./...` or `npm test` while other workers are editing sibling packages.
2. Fail Fast and Zero Fallbacks: Never add fallback mechanisms, mock modes for live data, or silent error suppression. Fail fast with clear error messages.
3. Proof and Completion: Once implementation passes package tests and linters, send your terminal validation output to your parent (Lead [Domain] Engineer) via `send_message`, then exit immediately to release your concurrency slot.
```

### 3. Domain Specification First ("Design Document First")
- Before launching Specialists, write or update your domain's technical specification, Go package interfaces, data schemas, or asset contracts in `docs/`.
- Save specifications in `docs/` so every Specialist in your team implements against the same types and contracts.

### 4. Task Breakdown, Single Writer Boundaries, and Backlog Drip-Feeding
- Break your domain epic into independent tasks with disjoint target files.
- **Single Writer Principle and Staging Pattern**: Give only one Specialist write access to any file at a time. When multiple workers contribute entries to a shared registry or document, assign separate `staging/` files and have a final domain Specialist merge them.
- **Backlog Drip-Feeding**: When your domain has more tasks than active Specialist slots (`DOP - 1`), maintain a task backlog. Launch up to `DOP - 1` Specialists first, then launch the next task from the backlog each time an active worker finishes and frees its slot.

### 5. Strict Hierarchical Communication
- **Allowed Messaging:**
  - Send messages to your parent agent (the ROOT Swarm Coordinator).
  - Send messages to your child agents (your domain Specialists).
- **Forbidden Messaging:**
  - **No Sibling Messaging:** Never message sibling Lead Agents or Specialists in other domains directly.
  - **No Direct User Interaction:** Send all user-facing questions to the Swarm Coordinator via `send_message`.
- **Cross-Domain Changes:**
  - If a change in your domain affects another domain's contract, update the shared specification in `docs/` first, then notify the Swarm Coordinator via `send_message`.

### 6. Domain Deliverable Review and Reconciliation
- Review the code changes and terminal validation logs returned by your Specialists.
- **Domain Reconciliation**: Verify that all temporary stubs or staged chunks inside your domain are replaced with working implementations before reporting domain completion to the Swarm Coordinator.
