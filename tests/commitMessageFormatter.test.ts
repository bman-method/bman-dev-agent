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

const warningBlock = [
  "⚠️ AI-GENERATED COMMIT.",
  "",
  "This change was produced by an AI agent and has NOT been reviewed or validated by a human.",
  "Do not assume correctness, completeness, or production readiness.",
  "",
  "Human review is required.",
].join("\n");

describe("DefaultCommitMessageFormatter", () => {
  const formatter = new DefaultCommitMessageFormatter();

  it("builds a title and body for successful tasks", () => {
    const output: AgentOutput = {
      taskId: task.id,
      status: "success",
      commitMessage: "Add new feature\n\nImplement the feature body",
      ...thoughts,
    };

    expect(formatter.formatTitle(task, output)).toBe("TASK-1 [completed]: Add new feature");
    expect(formatter.formatBody(task, output)).toBe(
      [
        "Implement the feature body",
        "---",
        [
          "AI Thoughts",
          "-----------",
          "",
          "Changes made",
          "------------",
          "Did the thing.",
          "",
          "Assumptions",
          "-----------",
          "None",
          "",
          "Decisions taken",
          "---------------",
          "Kept scope small.",
          "",
          "Points of unclarity",
          "-------------------",
          "None",
          "",
          "Tests run",
          "---------",
          "Not run",
        ].join("\n"),
        warningBlock,
      ].join("\n\n")
    );
  });

  it("prefixes status in title for non-success and falls back to status reason", () => {
    const output: AgentOutput = {
      taskId: task.id,
      status: "blocked",
      commitMessage: "",
      ...emptyThoughts,
    };

    expect(formatter.formatTitle(task, output)).toBe("TASK-1 [blocked]: Task ended with status: blocked");
    expect(formatter.formatBody(task, output)).toBe(
      [
        "Task ended with status: blocked",
        "---",
        [
          "AI Thoughts",
          "-----------",
          "",
          "Changes made",
          "------------",
          "",
          "Assumptions",
          "-----------",
          "",
          "Decisions taken",
          "---------------",
          "",
          "Points of unclarity",
          "-------------------",
          "",
          "Tests run",
          "---------",
        ].join("\n"),
        warningBlock,
      ].join("\n\n")
    );
  });

  it("falls back to status message when commitMessage is empty, even when thoughts are present", () => {
    const output: AgentOutput = {
      taskId: task.id,
      status: "blocked",
      commitMessage: "",
      changesMade: "Blocked on DB migration",
      assumptions: "None",
      decisionsTaken: "Escalate to infra",
      pointsOfUnclarity: "Deployment window unclear",
      testsRun: "Investigating rollout",
    };

    expect(formatter.formatTitle(task, output)).toBe(
      "TASK-1 [blocked]: Task ended with status: blocked"
    );
    expect(formatter.formatBody(task, output)).toBe(
      [
        "Task ended with status: blocked",
        "---",
        [
          "AI Thoughts",
          "-----------",
          "",
          "Changes made",
          "------------",
          "Blocked on DB migration",
          "",
          "Assumptions",
          "-----------",
          "None",
          "",
          "Decisions taken",
          "---------------",
          "Escalate to infra",
          "",
          "Points of unclarity",
          "-------------------",
          "Deployment window unclear",
          "",
          "Tests run",
          "---------",
          "Investigating rollout",
        ].join("\n"),
        warningBlock,
      ].join("\n\n")
    );
  });
});
