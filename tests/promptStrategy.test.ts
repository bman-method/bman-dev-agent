import { DefaultPromptStrategy } from "../src/promptStrategy";
import { OutputContract, PromptInput, Task } from "../src/types";
import path from "node:path";

const task: Task = {
  id: "TASK-5",
  title: "Implement prompt strategy",
  description: "Build a deterministic prompt.",
  status: "open",
};

const contract: OutputContract = {
  fields: [
    { name: "taskId", descriptionOfContent: "Task identifier" },
    {
      name: "status",
      descriptionOfContent:
        "The status of the task implementation, can be success or blocked. Note that if the implementation could not be completed or verified from any reason (network connectivity, test failure, compilation issues, linter issues or misunderstanding of the requirements), then the status should be blocked.",
    },
    { name: "commitMessage", descriptionOfContent: "Summary", maxLines: 5 },
    { name: "changesMade", descriptionOfContent: "Changes", maxLines: 20 },
    { name: "assumptions", descriptionOfContent: "Assumptions", maxLines: 20 },
    { name: "decisionsTaken", descriptionOfContent: "Decisions", maxLines: 20 },
    { name: "pointsOfUnclarity", descriptionOfContent: "Unclarities", maxLines: 20 },
    { name: "testsRun", descriptionOfContent: "Tests", maxLines: 20 },
  ],
};

function buildInput(overrides: Partial<PromptInput> = {}): PromptInput {
  const base: PromptInput = {
    task,
    config: {
      agent: {
        default: "codex",
        registry: {
          codex: { cmd: ["codex"] },
        },
      },
      tasksFile: "tasks.md",
      outputDir: ".out",
    },
    runContext: {
      taskId: task.id,
      runId: "run-123",
      timestamp: "20240101000000000",
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
      "Output contract:\n- taskId: Task identifier\n- status: The status of the task implementation, can be success or blocked. Note that if the implementation could not be completed or verified from any reason (network connectivity, test failure, compilation issues, linter issues or misunderstanding of the requirements), then the status should be blocked.\n- commitMessage (max 5 lines): Summary\n- changesMade (max 20 lines): Changes\n- assumptions (max 20 lines): Assumptions\n- decisionsTaken (max 20 lines): Decisions\n- pointsOfUnclarity (max 20 lines): Unclarities\n- testsRun (max 20 lines): Tests"
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

  it("renders output file path relative to the current working directory", () => {
    const absoluteOutputPath = path.join(process.cwd(), ".out", "TASK-5", "run-123.json");

    const prompt = new DefaultPromptStrategy().build(
      buildInput({
        runContext: {
          taskId: task.id,
          runId: "run-123",
          timestamp: "20240101000000000",
          attempt: 1,
          outputPath: absoluteOutputPath,
        },
      })
    );

    expect(prompt).toContain(`Output file:\n.out${path.sep}TASK-5${path.sep}run-123.json`);
  });
});
