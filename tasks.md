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

- [x] TASK-13: CLI Wiring
Ship a runnable CLI entry point (bin script) that:
* Parses minimal flags (run-once default, --all for sequential)
* Supports optional agent override but only accepts Codex
* Wires up the orchestrator with default deps and uses config loader defaults
* Exits non-zero on orchestrator errors

- [x] TASK-14: Fix bug
* I tried to run the cli to perform a single task. It actually worked, performed the task committed it, but did not commit the tracker file change in the same commit. So I was left with uncommitted changes. It is required to add the tracker status change to the same commit of the task completion.

- [x] TASK-15: Enhance codex logging
When I run tasks, I see the entire codex log in STDOUT.
I believe that the log should be written to a file: {output-folder}/logs/codex-{taskid}-{timestamp}.log
And the console log should indicate that codex is running and writing the logs to this location
(show the actual location)
I believe that this should be implemented in the CodexAgent class because its codex specific.

- [x] TASK-16: Commit guidelines in output contract
Update the output contract commitMessage description (src/outputContract.ts) to include concise commit guidelines (imperative subject ≤50 chars, blank line before body, ~72-char body focusing on what/why).

- [x] TASK-17: aiThoughts prompt sections
Improve the aiThoughts instructions (prompt/output contract) so the model outputs these sections every time: Changes made; Assumptions; Decisions taken; Points of unclarity (explicitly say “None” if none); Tests run status. Ensure the prompt makes this structure clear even when a section is empty.

- [x] TASK-18: README alignment with B-MAN Method
Read bman-method.md and enhance readme.md to specify how this tool aligns with the method.

- [x] TASK-19: Stop when blocked tasks exist
If any task in the tracker is blocked, the CLI should refuse to start new work and exit non-zero, telling the human to resolve the block first.

- [x] TASK-20: Ensure blocked/failure reasons land in commit info
Normalize/propagate the blocked/failure reason into the commit title/body so the “why” is preserved even when the agent omits it.

- [x] TASK-21: Remove unused designFile config
Delete the designFile knob from config and code paths since it isn’t used in prompts.

- [x] TASK-22: Split aiThoughts into structured fields
Update the output contract and validation to require separate fields for the AI thought sections (Changes made, Assumptions, Decisions taken, Points of unclarity, Tests run).

- [ ] TASK-23: Optional push flag
Add a CLI flag `--push` (opt-in) that triggers git push after each task; implement the push behavior instead of a no-op, keeping push disabled by default.
