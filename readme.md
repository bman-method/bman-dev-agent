# bman-dev-agent (B-MAN aligned)

A developer-controlled CLI that resolves **one tracked coding task at a time** using the [B-MAN Method](https://github.com/bman-method).

`bman-dev-agent` runs a configured **dev agent** (Codex / Claude / Gemini / custom command), enforces **one task → one commit**, and embeds a structured **AI self-report** (assumptions, decisions, uncertainties, tests) in the commit body for fast and safe human review.

This tool is intentionally **non-autonomous**: it accelerates execution while keeping humans fully in control.

---

## Key ideas (B-MAN alignment)

### One task → one commit

The orchestrator picks the next open task from the branch tracker
(`.bman/tracker/<branch>/tasks.md` by default), **requires a clean working tree**, executes exactly one task, updates the tracker, and commits the entire change set **as a single commit** (code + tracker update).

This makes AI work:

* reviewable
* revertible
* attributable

### Explicit boundaries

For each task, the agent prompt includes:

* task id / title / description
* task prelude and list of completed tasks
* the **exact output path**
* instructions to write **only** a structured JSON result to that path

The agent is free to modify the working tree to complete the task, but **all reporting happens through the JSON output contract**.
This narrows scope, prevents silent behavior, and makes deviations visible.

### Explain every change (AI self-report)

The output contract (`src/outputContract.ts`) requires structured, human-readable fields such as:

* `changesMade`
* `assumptions`
* `decisionsTaken`
* `pointsOfUncertainty`
* `testsRun`

The commit formatter then:

* prefixes the subject with `TASK-XX [completed|blocked]`
* appends an **AI Thoughts** section containing the self-report
* ends with an explicit **human review warning**

> This is **not chain-of-thought extraction**.
> It is a deliberate, bounded self-report designed to support fast, informed human review.

### Abort is a feature

A task may end with status `blocked`.

* The blocking reason is persisted in the task tracker
* Run artifacts and logs are preserved
* Further tasks are **not executed** until a human intervenes

Early stopping is treated as a **safety mechanism**, not a failure mode.

---

## Requirements

* Node.js **20+**
* Git
* A **clean working tree** before running `resolve`
* An installed **dev agent executable** (Codex CLI, Claude Code, Gemini CLI, or a custom command), properly authenticated

---

## Quick start

> **Prerequisites**
>
> * `git` is installed and available on `PATH`
> * At least one supported dev agent CLI is installed and configured

```bash
npm i -g @b-man/bman-dev-agent

# add a task to the current branch tracker
bman-dev-agent add-task "Describe the change + DoD + test scenarios"

# resolve the next open task (single commit)
bman-dev-agent resolve

# resolve tasks sequentially until blocked or failed
bman-dev-agent resolve --all

# push after each task commit (opt-in)
bman-dev-agent resolve --all --push
```

---

## How it works (high level)

1. Reads the next open task from the branch tracker
2. Builds a bounded prompt and output contract
3. Executes the configured agent command
4. Validates the JSON output
5. Applies code changes and updates the task tracker
6. Creates **one commit** containing:

   * code changes
   * tracker update
   * AI self-report in the commit body

If the task is blocked or output validation fails, the process stops.

---

## Credentials & authentication

`bman-dev-agent` itself does not manage credentials.
Each built-in agent relies on its own CLI authentication mechanism.

Usually, one of the simple ways for authentication is to provide environment variable with the tool specific API key:

* **Codex CLI**: may require `CODEX_API_KEY`
* **Claude Code**: may require `ANTHROPIC_API_KEY`
* **Gemini CLI**: may require `GEMINI_API_KEY`
* **Custom agents**: May need other env variables depends on their requirements

No credentials are written to disk or committed to Git.

---

## Output contract (example)

Each agent run must produce a JSON file at the provided output path.

Example:

```json
{
  "status": "completed",
  "summary": "Add eslint configuration and enforce rule X",
  "changesMade": ["Added eslint config", "Updated package.json scripts"],
  "assumptions": ["Project uses Node 20+"],
  "decisionsTaken": ["Chose rule X over Y for consistency"],
  "pointsOfUncertainty": ["Whether rule X is too strict for legacy files"],
  "testsRun": ["npm test"]
}
```

For blocked tasks:

```json
{
  "status": "blocked",
  "blockedReason": "Missing clarification about supported Node versions"
}
```

When the output json is missing or maleformed, bman-dev-agent marks the task is Blocked and refuses to continue to the next task.
---

## Configuration

Configuration is optional and lives in `.bman/config.json`.
If the file does not exist, `bman-dev-agent` uses defaults.

### Agent configuration

The `agent` section uses a `default` + `registry` structure.
Registry entries may override built-in agent defaults.

```json
{
  "agent": {
    "default": "my-agent",
    "registry": {
      "my-agent": {
        "cmd": ["my-agent", "run", "--format", "json"]
      }
    }
  },
  "tasksFile": ".bman/tracker/main/tasks.md",
  "outputDir": ".bman/output"
}
```

**Notes**

* `agent.registry.<name>.cmd` is an array of command + args
* `agent.default` must resolve to a registry entry (built-in or custom)
* You can select an agent at runtime via
  `bman-dev-agent resolve --agent <name>`

Here is the default agents registry:

```json
{
  "codex": {
    "cmd": ["codex", "exec", "--sandbox", "workspace-write", "--skip-git-repo-check", "-"]
  },

  "claude": {
    "cmd": ["claude", "--allowedTools", "Read,Write,Bash", "--output-format", "json", "-p", "--verbose"]
  },

  "gemini": {
    "cmd": ["gemini", "--approval-mode", "auto_edit"]
  }
}
```

The built in registry is merged wit the config file registry - the file overrides the default config for each agent. Meaning that if I have only "claude" in my config file,
then if the user choose to use "claude" it will ignore the built in default and use the config file. However, if the user will choose codex, it will take the defalts.

---

## Supported dev agents

`bman-dev-agent` is **agent-agnostic**.
Orchestration, safety guarantees, and commit discipline are independent of the underlying LLM or tool.

Built-in agents:

* **Codex CLI**
* **Claude Code**
* **Gemini**
* **Custom command** (any executable that follows the output contract)

---

## Logs & artifacts

Each run produces logs under:

```
<outputDir>/logs/<agent>-<taskId>-<timestamp>.log
```

Logs include:

* raw agent interaction
* validation errors (if any)

---

## CI (GitHub Actions) example

**Notes**

* `contents: write` is required **only if using `--push`**
* The workflow exits with exit code 1 if a task is `blocked` or if the run fails, surfacing required human intervention in CI

```yaml
name: bman-dev-agent

on:
  workflow_dispatch:
  push:
    branches:
      - ai/**

permissions:
  contents: write

jobs:
  run-agent:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install bman-dev-agent
        run: npm i -g @b-man/bman-dev-agent

      - name: Run agent
        env:
          CODEX_API_KEY: ${{ secrets.CODEX_API_KEY }}
        run: bman-dev-agent resolve --all --push
```

---

## Recommended workflow

1. Create a new branch (e.g. `ai/<topic>`)
2. Add tasks using:

   ```bash
   bman-dev-agent add-task "<task description>"
   ```

   Each task should include:

   * a clear **Definition of Done**
   * explicit **test scenarios**
3. Run the agent (`resolve` or `resolve --all`)
4. Review **every task commit**:

   * code changes
   * tracker update
   * AI self-report in the commit body
5. If something is wrong:

   * **Option A:** add a follow-up task (like a human code review)
   * **Option B:** `git reset` / `git revert` to the last good commit, refine the task, and rerun
6. Proceed only after human approval

Resetting often indicates that the **task definition was insufficiently precise**.
The AI self-report usually explains *why* the task went off-track, making refinement easier.

---

## What this tool does — and does not do

**Does**

* Enforce one task → one commit
* Require clean working tree
* Preserve AI self-report and uncertainty
* Stop safely on ambiguity or missing information

**Does not**

* Autonomously design systems
* Merge PRs or bypass review
* Hide uncertainty
* Replace engineering judgment

---

## Philosophy

> **AI should accelerate engineering — not obscure it.**
> **Control beats cleverness.**
> **Transparency beats autonomy.**

`bman-dev-agent` treats AI as a powerful but bounded contributor.
Humans define intent, review outcomes, and retain full ownership of the codebase.
