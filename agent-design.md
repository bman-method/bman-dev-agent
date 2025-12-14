# bman-dev-agent AI (B-MAN Method) – Codex Task Brief

## What this project is

bman-dev-agent is a **developer-controlled coding agent** built around the B-MAN Method. (see file bman-method.md)

The core idea:
- The AI does **implementation only**
- Humans keep **full control** via Git
- Every AI action results in a **commit with explicit AI thoughts**
- Nothing is “autonomous” beyond a single task execution

This project is intentionally *not*:
- an autonomous PR generator
- a “trust the AI” workflow
- a black box coding system

The AI must explain itself, and the human decides what survives.

---

## Scope of this iteration (v0)

This version is intentionally minimal.

**Goals**
- Run one task at a time from a tasks file
- Let the AI implement the task
- Force the AI to write a structured JSON result file
- Turn that result into a Git commit
- Mark the task as done or blocked

---

## Core flow (high level)

1. Load configuration
2. Load tasks file
3. Pick the next open task
4. Create a run context (output path, run id, attempt)
5. Build a prompt for the agent
6. Run the agent (agent must write a JSON output file)
7. Read and validate the JSON output
8. Create a Git commit using the validated output
9. Mark the task as done or blocked
10. Stop

Refer to:
- `types-design.md` for contracts
- `orchestrator.md` for the authoritative execution flow

---

## Output contract (important)

The agent **does not return text**.

It must write a JSON file to the path provided in the prompt, containing:
- `taskId` (string)
- `status` (`success | blocked | failed`)
- `commitMessage` (string)
- `changesMade` (string)
- `assumptions` (string)
- `decisionsTaken` (string)
- `pointsOfUnclarity` (string)
- `testsRun` (string)

This contract is enforced by the validator.
The orchestrator only works with the validated, typed output.

---

## Development tasks (ordered)

### 0. Empty typescript project template with hello world test
- Do not use any dependencies except for jest for testing

### 1. Task Tracker
- Parse the tasks file
- Detect task id, title, description, and status
- Pick the next open task
- Update task status (done / blocked)
- Save the file back deterministically

Keep it boring and predictable.

---

### 2. Run Context Factory
- Generate a unique run id
- Decide where the agent output JSON is written
- Ensure output directories exist

No logic beyond naming and paths.

---

### 3. Output Contract (v1)
- Define the fields expected from the agent
- Keep it minimal and human-readable
- No JSON Schema library required at this stage

This contract will be referenced by both:
- the prompt builder
- the result validator

---

### 4. Task tracker refactor
Change TaskTracker to expose:
preludeText (raw text before tasks)
completedTasks (or enough info to derive them)
Update interfaces accordingly
Keep parsing stable; do not change task IDs/status format
see:

```
/* =========
 * TASK TRACKER (UPDATED)
 * ========= */

interface TaskTrackerDocument {
  preludeText: string;   // all text before the first task (instructions, intro, etc.)
  tasks: Task[];
}

interface TaskTracker {
  loadDocument(): TaskTrackerDocument;

  pickNextTask(tasks: Task[]): Task | null;

  markDone(tasks: Task[], taskId: string, commitSha: string): Task[];
  markBlocked(tasks: Task[], taskId: string, reason: string, commitSha?: string): Task[];

  saveDocument(doc: TaskTrackerDocument): void;
}

```

### 5. Prompt Strategy
- Build a prompt that:
  - Explains the task
  - Explains the output contract
  - Explicitly instructs the agent to write **only** to the output file
- Do not include execution flow or git instructions
- Assume Codex will also read the codebase and interfaces

The prompt must be deterministic and concise.

---

### 6. Codex Agent Adapter
- See: types-design.md - for information about the interface
- Implement the `CodeAgent` interface
- Send the prompt to Codex
- Wait for completion
- Fail if exit code is not 0
- Fail if output wasn't written to ctx.outputPath

---

### 7. Result Reader
- Read the output JSON file
- Do not validate
- Do not normalize
- Just parse

---

### 8. Result Validator
- Validate structure against the output contract
- Normalize fields into the `AgentOutput` type
- Fail loudly if anything is missing or malformed

This is a critical trust boundary.

---

### 9. Commit Message Formatter
- Create a clean commit title
- Create a commit body that:
  - Starts with the human-style commit message
  - Separates AI thoughts clearly (e.g. with a delimiter)
- No emojis, no marketing, no extra text

---

### 10. Git Ops
- Ensure clean working tree
- Create commit
- Push (can be a no-op implementation if desired)

Git is the **source of truth**, not the agent.

---

### 11. CLI Wiring
- Simple CLI to run:
  - one task
  - all tasks sequentially
- No background mode
- No daemon
- No flags beyond what’s necessary

---

## Final notes for the agent

- Do not add features that were not requested
- Do not invent retries, scoring, or autonomy
- If something feels unclear, keep the implementation simple and explicit
- The orchestrator implementation is the ground truth for behavior

When in doubt:
**Prefer clarity and control over cleverness.**
