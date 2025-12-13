Instructions:
- One task per run
- Keep output deterministic

- [x] TASK-0: Empty Typescript project template with hello world test
  Do not use any dependencies except for jest for testing.

- [x] TASK-1: Task Tracker
  Parse tasks file, detect id/title/description/status, pick next open task, update status (done/blocked), save deterministically.

- [x] TASK-2: Run Context Factory
  Generate unique run id, decide where agent output JSON is written, ensure output directories exist.

- [x] TASK-3: Output Contract (v1)
  Define fields expected from the agent; minimal and human-readable.

- [x] TASK-4: Task tracker refactor
  Expose preludeText and tasks; keep parsing stable; do not change task IDs/status format.

- [x] TASK-5: Prompt Strategy
  Build deterministic prompt that explains task, output contract, and instructs agent to write only to output file.

- [x] TASK-6: Codex Agent Adapter
  Implement CodeAgent interface to run Codex and ensure output file is written.

- [x] TASK-7: Result Reader
  Read output JSON file without validation or normalization.

- [x] TASK-8: Result Validator
  Validate structure against output contract; normalize into AgentOutput; fail loudly on issues.

- [x] TASK-9: Commit Message Formatter
  Create clean commit title and body separating AI thoughts.

- [x] TASK-10: Git Ops
  Ensure clean working tree; create commit; push (can be no-op).

- [x] TASK-11: Config Loader
  Load configuration, apply defaults, and validate required fields (agent, tasksFile, designFile?, outputDir).
   Note that:
     * The only supported agent is "Codex" (for v0)
     * Codex is the default agent
     * Config file location is: .bman/config.json
     * Default output dir is .bman/output 
     * Make sure the loader creates those folders if they don't exist (.bman and .bman/output)


- [x] TASK-12: Orchestrator
  Implement orchestrator per design, using refactored task tracker document and prompt strategy.

- [ ] TASK-13: CLI Wiring
  Simple CLI to run one task or all sequentially; no background mode; minimal flags.
