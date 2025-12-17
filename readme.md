# bman-dev-agent (B-MAN aligned)

Developer-controlled CLI that runs a single coding task at a time using the B-MAN Method (see `bman-method.md`). It keeps the AI inside strict boundaries, records its reasoning, and leaves clean, reviewable commits.

## How this tool aligns with the B-MAN Method
- One task -> one commit: the orchestrator picks the next open entry from the branch-specific tracker (`.bman/tracker/<branch>/tasks.md` by default), ensures a clean working tree, updates the task tracker, and commits everything from the run together (code + tracker change).
- Explicit boundaries: prompts include the task id/title/description, tasks prelude, list of completed tasks, the exact output path, and instructions to write only the JSON output to that path.
- Explain every change: the output contract (`src/outputContract.ts`) requires structured string fields (`changesMade`, `assumptions`, `decisionsTaken`, `pointsOfUnclarity`, `testsRun`); the commit formatter prefixes the agent-supplied commit message with `TASK-XX [completed/blocked]`, appends the AI Thoughts block, and closes with an AI-generated warning to flag human review.
- Human review ready: Git is the source of truth; runs halt on non-success statuses, leaving the commit, tracker status, and Codex logs (`<outputDir>/logs/codex-<taskId>-<timestamp>.log`) for inspection before proceeding.
- Abort is a feature: a `blocked` status stops further tasks, persists the reason in the task tracker, and preserves the run artifacts so the human can refine and rerun.

## Quick start
- Install deps: `npm install`
- Build once: `npm run build`
- Configure (optional): `.bman/config.json` sets `tasksFile` and `outputDir` (defaults created automatically; tracker defaults to `.bman/tracker/<branch>/tasks.md` based on the current git branch).
- Run the next task: `node dist/cli.js resolve` (or `./bin/bman-dev-agent resolve`) for one task, `node dist/cli.js resolve --all` to run sequentially until a block/failure. Add `--push` to push commits after each task (opt-in).

## CI (GitHub Actions) example
- Create a repository secret `CODEX_API_KEY` that holds your Codex API key (Settings → Secrets and variables → Actions → New repository secret).
- Ensure the workflow has `contents: write` so `bman-dev-agent --push` can commit and push per-task changes; the agent will process all open tasks sequentially on that branch, committing and pushing each. If it encounters a blocked task, it will still commit/push it and then fail the workflow to surface the issue.
- Decide how to trigger: on matching branches (e.g., `ai/*`) or manually via `workflow_dispatch` for safer control.
- Suggested workflow (Node shown; add other toolchains as needed):
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

        - name: Install build tools
          run: npm install

        - name: Build (compile only)
          run: npm run build --if-present

        - name: Install bman-dev-agent
          run: npm i -g @b-man/bman-dev-agent

        - name: Run bman-dev-agent
          env:
            CODEX_API_KEY: ${{ secrets.CODEX_API_KEY }}
          run: bman-dev-agent resolve --all --push
  ```
- The workflow exits non-zero if `bman-dev-agent` fails or reports a blocked task; a zero exit leaves the build green.

## Workflow
- Define tasks in the branch's tracker (`.bman/tracker/<branch>/tasks.md`), keeping one clear task per run so outputs stay deterministic.
- Use `bman-dev-agent add-task "<desc>"` to append a task; it will create the branch tracker automatically if it doesn't exist.
- Let `bman-dev-agent` execute tasks sequentially (single run or `--all`), producing a dedicated commit per task with the tracker update included.
- Review every task commit: the commit format, tracker status, and saved AI thoughts make it fast to spot intent, reasoning, and gaps.
- If you find an issue, choose how to respond:
  - Option 1: add an improvement task that fixes the issue, like a regular human code review follow-up.
  - Option 2: `git reset` to the last commit that passed review, then tighten the task description so the next run avoids the problem.
- Resetting is sometimes the better path: it preserves a clean history and forces clearer task definitions, often yielding a better solution than incremental fixes.
- Human review remains essential - this tool keeps work isolated and documented so you can audit commits quickly before letting the next task run.
