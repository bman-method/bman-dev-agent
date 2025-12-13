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

  it("prefixes status in title for non-success and falls back to task title", () => {
    const output: AgentOutput = {
      taskId: task.id,
      status: "blocked",
      commitMessage: "",
      aiThoughts: "",
    };

    expect(formatter.formatTitle(task, output)).toBe("[blocked] TASK-1 - Implement feature");
    expect(formatter.formatBody(task, output)).toBe(
      ["Task: TASK-1 - Implement feature", "Message: Implement feature"].join("\n")
    );
  });
});
