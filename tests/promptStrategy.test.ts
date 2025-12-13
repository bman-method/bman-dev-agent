import { DefaultPromptStrategy } from "../src/promptStrategy";
import { OutputContract, PromptInput, Task } from "../src/types";

const task: Task = {
  id: "TASK-5",
  title: "Implement prompt strategy",
  description: "Build a deterministic prompt.",
  status: "open",
};

const contract: OutputContract = {
  fields: [
    { name: "taskId", descriptionOfContent: "Task identifier" },
    { name: "status", descriptionOfContent: "success | blocked | failed" },
    { name: "commitMessage", descriptionOfContent: "Summary", maxLines: 5 },
    { name: "aiThoughts.changesMade", descriptionOfContent: "Changes", maxLines: 20 },
    { name: "aiThoughts.assumptions", descriptionOfContent: "Assumptions", maxLines: 20 },
    { name: "aiThoughts.decisionsTaken", descriptionOfContent: "Decisions", maxLines: 20 },
    { name: "aiThoughts.pointsOfUnclarity", descriptionOfContent: "Unclarities", maxLines: 20 },
    { name: "aiThoughts.testsRun", descriptionOfContent: "Tests", maxLines: 20 },
  ],
};

function buildInput(overrides: Partial<PromptInput> = {}): PromptInput {
  const base: PromptInput = {
    task,
    config: {
      agent: "codex",
      tasksFile: "tasks.md",
      outputDir: ".out",
    },
    runContext: {
      taskId: task.id,
      runId: "run-123",
      attempt: 1,
      outputPath: ".out/TASK-5/run-123.json",
    },
    contract,
    trackerDocument: {
      preludeText: "Instructions go here.",
      tasks: [
        task,
        { id: "TASK-1", title: "Done task", description: "", status: "done" },
        { id: "TASK-2", title: "Blocked task", description: "", status: "blocked" },
      ],
    },
  };

  return { ...base, ...overrides };
}

describe("DefaultPromptStrategy", () => {
  it("builds a deterministic prompt containing task, prelude, other tasks, output file, and contract", () => {
    const prompt = new DefaultPromptStrategy().build(buildInput());

    expect(prompt).toContain("Task:\nTASK-5 - Implement prompt strategy\nBuild a deterministic prompt.");
    expect(prompt).toContain("Tasks file prelude:\nInstructions go here.");
    expect(prompt).toContain("Completed tasks:\nTASK-1 [done] - Done task");
    expect(prompt).not.toContain("TASK-2 [blocked]");
    expect(prompt).toContain("Output file:\n.out/TASK-5/run-123.json");
    expect(prompt).toContain(
      "Output contract:\n- taskId: Task identifier\n- status: success | blocked | failed\n- commitMessage (max 5 lines): Summary\n- aiThoughts.changesMade (max 20 lines): Changes\n- aiThoughts.assumptions (max 20 lines): Assumptions\n- aiThoughts.decisionsTaken (max 20 lines): Decisions\n- aiThoughts.pointsOfUnclarity (max 20 lines): Unclarities\n- aiThoughts.testsRun (max 20 lines): Tests"
    );
    expect(prompt).toContain("Instructions:\nYou are executing exactly one task.");
  });

  it("says None when there is no prelude or other tasks", () => {
    const prompt = new DefaultPromptStrategy().build(
      buildInput({
        trackerDocument: { preludeText: "", tasks: [task] },
      })
    );

    expect(prompt).toContain("Tasks file prelude:\nNone.");
    expect(prompt).toContain("Completed tasks:\nNone.");
  });
});
