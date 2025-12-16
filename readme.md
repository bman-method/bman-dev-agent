# bman-dev-agent (B-MAN aligned)

Developer-controlled CLI that runs a single coding task at a time using the B-MAN Method (see `bman-method.md`). It keeps the AI inside strict boundaries, records its reasoning, and leaves clean, reviewable commits.

## How this tool aligns with the B-MAN Method
- One task -> one commit: the orchestrator picks the next open entry from the branch-specific tracker (`.bman/tracker/<branch>/tasks.md` by default), ensures a clean working tree, updates the task tracker, and commits everything from the run together (code + tracker change).
- Explicit boundaries: prompts include the task id/title/description, tasks prelude, list of completed tasks, the exact output path, and instructions to write only the JSON output to that path.
- Explain every change: the output contract (`src/outputContract.ts`) requires structured string fields (`changesMade`, `assumptions`, `decisionsTaken`, `pointsOfUnclarity`, `testsRun`); the commit formatter prefixes the agent-supplied commit message with `TASK-XX [completed/blocked]`, appends the AI Thoughts block, and closes with an AI-generated warning to flag human review.
- Human review ready: Git is the source of truth; runs halt on non-success statuses, leaving the commit, tracker status, and Codex logs (`<outputDir>/logs/codex-<taskId>-<timestamp>.log`) for inspection before proceeding.
- Abort is a feature: `blocked`/`failed` statuses stop further tasks, persist the reason in the task tracker, and preserve the run artifacts so the human can refine and rerun.

## Quick start
- Install deps: `npm install`
- Build once: `npm run build`
- Configure (optional): `.bman/config.json` sets `tasksFile` and `outputDir` (defaults created automatically; tracker defaults to `.bman/tracker/<branch>/tasks.md` based on the current git branch).
- Run the next task: `node dist/cli.js resolve` (or `./bin/bman-dev-agent resolve`) for one task, `node dist/cli.js resolve --all` to run sequentially until a block/failure. Add `--push` to push commits after each task (opt-in).

## Workflow
- Define tasks in the branch's tracker (`.bman/tracker/<branch>/tasks.md`), keeping one clear task per run so outputs stay deterministic.
- Let `bman-dev-agent` execute tasks sequentially (single run or `--all`), producing a dedicated commit per task with the tracker update included.
- Review every task commit: the commit format, tracker status, and saved AI thoughts make it fast to spot intent, reasoning, and gaps.
- If you find an issue, choose how to respond:
  - Option 1: add an improvement task that fixes the issue, like a regular human code review follow-up.
  - Option 2: `git reset` to the last commit that passed review, then tighten the task description so the next run avoids the problem.
- Resetting is sometimes the better path: it preserves a clean history and forces clearer task definitions, often yielding a better solution than incremental fixes.
- Human review remains essential - this tool keeps work isolated and documented so you can audit commits quickly before letting the next task run.
