import { DefaultCommitMessageFormatter } from "../src/commitMessageFormatter";
import { AgentOutput, Task } from "../src/types";

const task: Task = {
  id: "TASK-1",
  title: "Implement feature",
  description: "",
  status: "open",
};

const thoughts = {
  changesMade: "Did the thing.",
  assumptions: "None",
  decisionsTaken: "Kept scope small.",
  pointsOfUnclarity: "None",
  testsRun: "Not run",
};

const emptyThoughts = {
  changesMade: "",
  assumptions: "",
  decisionsTaken: "",
  pointsOfUnclarity: "",
  testsRun: "",
};

describe("DefaultCommitMessageFormatter", () => {
  const formatter = new DefaultCommitMessageFormatter();

  it("builds a title and body for successful tasks", () => {
    const output: AgentOutput = {
      taskId: task.id,
      status: "success",
      commitMessage: "Add new feature",
      aiThoughts: thoughts,
    };

    expect(formatter.formatTitle(task, output)).toBe("TASK-1 - Add new feature");
    expect(formatter.formatBody(task, output)).toBe(
      [
        "Task: TASK-1 - Implement feature",
        "Message: Add new feature",
        "---",
        "AI Thoughts:",
        "Changes made: Did the thing.",
        "Assumptions: None",
        "Decisions taken: Kept scope small.",
        "Points of unclarity: None",
        "Tests run: Not run",
      ].join("\n")
    );
  });

  it("prefixes status in title for non-success and falls back to status reason", () => {
    const output: AgentOutput = {
      taskId: task.id,
      status: "blocked",
      commitMessage: "",
      aiThoughts: emptyThoughts,
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
      aiThoughts: {
        changesMade: "Blocked on DB migration",
        assumptions: "None",
        decisionsTaken: "Escalate to infra",
        pointsOfUnclarity: "Deployment window unclear",
        testsRun: "Investigating rollout",
      },
    };

    expect(formatter.formatTitle(task, output)).toBe(
      "[failed] TASK-1 - Changes made: Blocked on DB migration Assumptions: None Decisions taken: Escalate to infra Points of unclarity: Deployment window unclear Tests run: Investigating rollout"
    );
    expect(formatter.formatBody(task, output)).toBe(
      [
        "Task: TASK-1 - Implement feature",
        "Message: Changes made: Blocked on DB migration\nAssumptions: None\nDecisions taken: Escalate to infra\nPoints of unclarity: Deployment window unclear\nTests run: Investigating rollout",
        "---",
        "AI Thoughts:",
        "Changes made: Blocked on DB migration",
        "Assumptions: None",
        "Decisions taken: Escalate to infra",
        "Points of unclarity: Deployment window unclear",
        "Tests run: Investigating rollout",
      ].join("\n")
    );
  });
});
