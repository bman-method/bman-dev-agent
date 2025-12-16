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

- [x] TASK-23: Optional push flag
Add a CLI flag `--push` (opt-in) that triggers git push after each task; implement the push behavior instead of a no-op, keeping push disabled by default.

- [x] TASK-24: Tracker file  per branch
Instead of the default tracker: tasks.md, I'd like you to make the default tracker location to be:
.bman/tracker/<branchName>/tasks.md.
This will allow merging feature branches with their trackers but still avoiding conflicts.

- [x] TASK-25: Add TS linter
Add a typescript linter to this project with the usual industry standad convensions.
Ensure that there is an option to run the linter via "npm run lint" with an option to auto fix.
I don't care about all the rules, but I do care for:
* Not allowing "if" without curly braces. Same else and all other syntax structures.
* Not allowing dead code (unused var / import for instance)
* Not allowing untyped things
Make sure that during this task you also run the auto fix, and if it fails, fix manually the things that must be fixed.

- [x] TASK-26: Refactor: Do not execute git command in taskFile.ts. The only component that allowed to run git is the GitOps.ts. I think its better to make the orchestrator to pass the current branch name to the config loader and it will pass to getDefaultTasksFilePath function.
In addition, please remove the BMAN_BRANCH fallback. You can add start up validation in the CLI that git is available and that it's possible to get the current branch name. If not, then exit with an error message and non 0 exit code.

- [x] TASK-27: Improve readability of commit messages
Currently, the commit messages don't look good and have duplications. I think that part of the reason for that is that the commit formatter is returning 2 different fields, one for the title and another for the body, while the contract with the LLM makes it create a single commit message that has title and body already. You can explore the commits in this branch and see what I mean.
Anyway, the required format is:

TASK-XX [completed/blocked]: <commitMessage from agent output which includes title

and body>

---

<AI thouhgts> - Leave it as is - looks ok.

⚠️ AI-GENERATED COMMIT. <--- Additional warning at the bottom of the commit body

This change was produced by an AI agent and has NOT been reviewed or validated by a human.
Do not assume correctness, completeness, or production readiness.

Human review is required.

Example:

```
TASK-26[completed]: Route branch resolution through GitOps

Centralize branch lookup in GitOps and pass it into config. Remove BMAN_BRANCH fallback and validate git availability early.

---

AI Thoughts
-----------
Changes made: - Moved branch resolution into DefaultGitOps and removed git calls from tasksFile.
- Config loader now requires a branch for default tasks path, and orchestrator passes branchName through deps.
- CLI validates git availability/branch upfront and threads branchName into config loading and task tracking.
- Added coverage for branch requirement and updated mocks for the new interfaces.
Assumptions: - Git is available when running the CLI.
Decisions taken: - Kept detached HEAD fallback via short SHA while removing BMAN_BRANCH env usage.
- Let the CLI own branch validation to keep git commands within GitOps.
Points of unclarity: None
Tests run: - npm test

⚠️ AI-GENERATED COMMIT. <--- Additional warning at the bottom of the commit body

This change was produced by an AI agent and has NOT been reviewed or validated by a human.
Do not assume correctness, completeness, or production readiness.

Human review is required.
```

- [x] TASK-28: Enforce types in the contract prompt.
See: DefaultOutputContract class. It does not strictly requests string format to all the properties.
Therefore the model sometimes produces the output with string array instead of string.
To make it simpler for the model to handle the task of building this json I'd like to avoid the nested
aiThoughts object and have the contract built only from primitive types.
In addition, as part of the description of each property, we should tell what is it's type.

I believe that changing the field's record from:
```
{
name: "aiThoughts.changesMade",
descriptionOfContent: "What changed in this task; keep concise but specific.",
maxLines: 20,
}
```
To:
```
{
name: "changesMade",
descriptionOfContent: "(type: string), What changed in this task; keep concise but specific.",
maxLines: 20,
}
```
Will do the trick.
It will require refactor of types to get rid of the aiThoughts object and replace it with flat properties.

- [x] TASK-29: Improve readme.md
The readme is lacking the description of the workflow with the tool which is:
* Define tasks in the tasks.md file of the branch
* Let bman-dev-agent perform those tasks sequentially and produce a detailed commit per task
* Review all the commits
* In case of an issue there are 2 options:
* Option 1:
- Add improvement task that will fix the issue (like it is done in regular human code reviews)
* Option 2:
- perform git reset to the last commit that passed the review
- Improve the task description to avoid this issue from poping up, next time the model implements the task.

* It's need to be explained that sometimes reset is the better choice because we can get cleaner solution and it also makes us better in defining tasks.
* Also emphasise how important is the human review of all the tasks and how the tool makes it wasy to do it quickly.


- [ ] TASK-30: Remove the home made linter and use an industry standard linter with the same rules discussed in task 25.
Please add an additional rule: keep 1 line space between functions.

- [ ] TASK-31: Remove the timestamp extraction from runId. Instead, add timestamp as a separate field in the runContext and use it.

- [ ] TASK-32: Scan the code and refactor places that you use inline types.
For example: in commitMessageFormatter.ts you did:
```
status: AgentOutput["status"]
```
Instead, create a type AgentOutputStatus in the typs.ts.
There are several more examples in the code, I'd like that all the types will be defined with names.
Also avoid doing this (also saw it in commitMessageFormatter.ts): 
```
function (): "completed" | "blocked" 
```

