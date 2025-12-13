import { DefaultCommitMessageFormatter } from "../src/commitMessageFormatter";
import { AgentOutput, Task } from "../src/types";

const task: Task = {
  id: "TASK-1",
  title: "Implement feature",
  description: "",
  status: "open",
};

describe("DefaultCommitMessageFormatter", () => {
  const formatter = new DefaultCommitMessageFormatter();

  it("builds a title and body for successful tasks", () => {
    const output: AgentOutput = {
      taskId: task.id,
      status: "success",
      commitMessage: "Add new feature",
      aiThoughts: "Did the thing.",
    };

    expect(formatter.formatTitle(task, output)).toBe("TASK-1 - Add new feature");
    expect(formatter.formatBody(task, output)).toBe(
      ["Task: TASK-1 - Implement feature", "Message: Add new feature", "---", "AI Thoughts:", "Did the thing."].join(
        "\n"
      )
    );
  });

  it("prefixes status in title for non-success and falls back to status reason", () => {
    const output: AgentOutput = {
      taskId: task.id,
      status: "blocked",
      commitMessage: "",
      aiThoughts: "",
    };

    expect(formatter.formatTitle(task, output)).toBe("[blocked] TASK-1 - Task ended with status: blocked");
    expect(formatter.formatBody(task, output)).toBe(
      ["Task: TASK-1 - Implement feature", "Message: Task ended with status: blocked"].join("\n")
    );
  });

  it("uses aiThoughts as fallback reason when commitMessage is empty", () => {
    const output: AgentOutput = {
      taskId: task.id,
      status: "failed",
      commitMessage: "",
      aiThoughts: "Blocked on DB migration\nInvestigating rollout",
    };

    expect(formatter.formatTitle(task, output)).toBe(
      "[failed] TASK-1 - Blocked on DB migration Investigating rollout"
    );
    expect(formatter.formatBody(task, output)).toBe(
      [
        "Task: TASK-1 - Implement feature",
        "Message: Blocked on DB migration\nInvestigating rollout",
        "---",
        "AI Thoughts:",
        "Blocked on DB migration\nInvestigating rollout",
      ].join("\n")
    );
  });
});
