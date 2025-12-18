# bman-dev-agent (B-MAN aligned)

A developer-controlled CLI that resolves **one coding task at a time** using the [B-MAN Method](https://github.com/bman-method).
It keeps the agent inside strict boundaries, produces **clean, reviewable commits**, and stores an **AI self-report** (assumptions, decisions, uncertainties, tests) in the commit message.

---

## Key ideas (B-MAN alignment)

### One task → one commit

The orchestrator picks the next open task from the branch tracker (`.bman/tracker/<branch>/tasks.md` by default), **requires a clean working tree**, updates the tracker, and commits the change set **as a single commit** (code + tracker update).

### Explicit boundaries

Prompts include:

* task id / title / description
* task prelude and list of completed tasks
* the **exact output path**
* instructions to write **only** the JSON output to that path

This keeps the agent narrowly scoped and prevents uncontrolled edits.

### Explain every change (AI self-report)

The output contract (`src/outputContract.ts`) requires structured, human-readable fields such as:

* `changesMade`
* `assumptions`
* `decisionsTaken`
* `pointsOfUncertainty`
* `testsRun`

The commit formatter:

* prefixes the subject with `TASK-XX [completed|blocked]`
* appends an **AI Thoughts** block containing the self-report
* ends with an explicit **human review warning**

> This is **not chain-of-thought extraction**. It is a deliberate, structured self-report designed for fast and safe human review.

### Abort is a feature

A task may end with status `blocked`.

* The reason is persisted in the task tracker
* Run artifacts and logs are preserved
* Further tasks are **not executed** until a human intervenes

This makes early stopping a first-class safety mechanism rather than a failure mode.

---

## Requirements

* Node.js **20+**
* Git
* A configured LLM provider API key (see below)
* A **clean working tree** before running `resolve`

---

## Quick start

> **Prerequisites:**
>
> * `git` is installed and available on `PATH`
> * `codex` CLI is installed and available on `PATH`

```bash
npm i -g @b-man/bman-dev-agent

# add a task to the current branch tracker
bman-dev-agent add-task "Describe the change + DoD + tests"

# resolve the next open task (single commit)
bman-dev-agent resolve

# resolve tasks sequentially until blocked or failed
bman-dev-agent resolve --all

# push after each task commit (opt-in)
bman-dev-agent resolve --all --push
```

---

## LLM provider

The agent reads provider credentials from environment variables:

* `CODEX_API_KEY` – API key for the configured LLM provider

Provider interaction logs are stored per run:

```
<outputDir>/logs/codex-<taskId>-<timestamp>.log
```

No credentials are written to disk or committed to Git.

---

## Supported dev agents

`bman-dev-agent` is designed to be **agent-agnostic**. The orchestration, safety guarantees, and commit discipline are independent of the underlying LLM or coding tool.

Currently supported:

* **Codex CLI** – the only built-in implementation today (required in `PATH`)

Planned / upcoming support:

* **Gemini** (via CLI or API wrapper)
* **Claude Code**
* **Custom command adapter** (any executable that follows the input/output contract)

The long-term goal is to allow swapping or mixing agents **without changing the workflow**, so teams can adopt new models while keeping the same B-MAN safety and review guarantees.

---

## CI (GitHub Actions) example

**Notes:**

* `contents: write` is required because when running in CI you must perform git push (--push) in order to be able to see the agent's changes
* The workflow exits **non-zero** if a task is `blocked` or if the tool had any other failure, surfacing the issue in CI

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
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Build (compile only)
        run: npm run build --if-present

      - name: Install bman-dev-agent
        run: npm i -g @b-man/bman-dev-agent

      - name: Run bman-dev-agent
        env:
          CODEX_API_KEY: ${{ secrets.CODEX_API_KEY }}
        run: bman-dev-agent resolve --all --push
```

---

## Recommended workflow

1. Create a new branch (e.g. `ai/<topic>`)
2. Add tasks using `bman-dev-agent add-task "<description>"`

   * Each task should include a **Definition of Done**
   * Include explicit **test scenarios**
   * Avoid more than ~10 tasks per tracker
3. Run the agent (`resolve` or `resolve --all`)
4. Review **every task commit**:

   * code changes
   * tracker update
   * AI self-report in the commit body
5. If something is wrong:

   * **Option A:** add a follow-up task (like a normal human code review)
   * **Option B:** `git reset` / `git revert` to the last good commit, refine the task definition, and rerun
6. Proceed only after human approval

Resetting is often a sign that the **task definition was insufficiently precise**. The AI self-report usually explains *why* the task went off-track, making it easier to refine and retry.

---

## Philosophy

> **AI should accelerate engineering — not obscure it.**  
> **Control beats cleverness.**  
> **Transparency beats autonomy.**

`bman-dev-agent` does not try to replace engineering judgment or make autonomous design decisions. Instead, it enforces:

* isolation of work
* explicit intent
* documented uncertainty
* commit-level accountability

This keeps AI-assisted development fast **without sacrificing control or safety**.
