# bman-dev-agent (B-MAN aligned)

Developer-controlled CLI that runs a single coding task at a time using the B-MAN Method (see `bman-method.md`). It keeps the AI inside strict boundaries, records its reasoning, and leaves clean, reviewable commits.

## How this tool aligns with the B-MAN Method
- One task -> one commit: the orchestrator picks the next open entry from `tasks.md`, ensures a clean working tree, updates the task tracker, and commits everything from the run together (code + tracker change).
- Explicit boundaries: prompts include the task id/title/description, tasks prelude, list of completed tasks, the exact output path, and instructions to write only the JSON output to that path.
- Explain every change: the output contract (`src/outputContract.ts`) requires structured `aiThoughts` sections split into explicit fields (changes, assumptions, decisions, points of unclarity, tests run); the commit formatter embeds them in the commit body alongside the task and human-style message.
- Human review ready: Git is the source of truth; runs halt on non-success statuses, leaving the commit, tracker status, and Codex logs (`<outputDir>/logs/codex-<taskId>-<timestamp>.log`) for inspection before proceeding.
- Abort is a feature: `blocked`/`failed` statuses stop further tasks, persist the reason in the task tracker, and preserve the run artifacts so the human can refine and rerun.

## Quick start
- Install deps: `npm install`
- Build once: `npm run build`
- Configure (optional): `.bman/config.json` sets `tasksFile` and `outputDir` (defaults created automatically).
- Run the next task: `node dist/cli.js` (or `./bin/bman-dev-agent`) for one task, `node dist/cli.js --all` to run sequentially until a block/failure.
