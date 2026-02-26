import {
  AgentOutput,
  AgentOutputStatus,
  CommitMessageFormatter,
  CommitStatusLabel,
  Task,
} from "./types";

type ThoughtFields = Pick<
  AgentOutput,
  "changesMade" | "assumptions" | "decisionsTaken" | "pointsOfUnclarity" | "testsRun"
>;

type CommitMessageParts = {
  title: string;
  body: string;
};

export function deriveHumanMessage(task: Task, output: AgentOutput): string {
  const commitMessage = output.commitMessage.trim();
  if (commitMessage) {
    return commitMessage;
  }

  if (output.status === "success") {
    return task.title;
  }

  return `Task ended with status: ${output.status}`;
}

function normalizeSingleLine(message: string): string {
  return message.replace(/\s+/g, " ").trim();
}

function parseCommitMessage(message: string): CommitMessageParts {
  const trimmed = message.trim();
  if (!trimmed) {
    return { title: "", body: "" };
  }

  const [firstLine, ...rest] = trimmed.split(/\r?\n/);
  const title = firstLine.trim();
  const body = rest.join("\n").trim();

  return { title, body };
}

function toStatusLabel(status: AgentOutputStatus): CommitStatusLabel {
  return status === "success" ? "completed" : "blocked";
}

const AI_COMMIT_WARNING = [
  "⚠️ AI-GENERATED COMMIT.",
  "",
  "This change was produced by an AI agent and has NOT been reviewed or validated by a human.",
  "Do not assume correctness, completeness, or production readiness.",
  "",
  "Human review is required.",
].join("\n");

export class DefaultCommitMessageFormatter implements CommitMessageFormatter {
  formatTitle(task: Task, output: AgentOutput): string {
    const { title: agentTitle } = parseCommitMessage(output.commitMessage);
    const statusLabel = toStatusLabel(output.status);
    const humanMessage = agentTitle || normalizeSingleLine(deriveHumanMessage(task, output));

    return `${task.id} [${statusLabel}]: ${humanMessage}`.trim();
  }

  formatBody(task: Task, output: AgentOutput): string {
    const { title: agentTitle, body: agentBody } = parseCommitMessage(output.commitMessage);
    const humanMessage = agentBody || (agentTitle ? "" : deriveHumanMessage(task, output));
    const thoughts = pickThoughts(output);
    const thoughtsSection = formatThoughtsSection(thoughts);

    const sections = [
      humanMessage.trim(),
      "---",
      thoughtsSection,
      AI_COMMIT_WARNING,
    ].filter((section) => section !== "");

    return sections.join("\n\n");
  }
}

function pickThoughts(output: AgentOutput): ThoughtFields {
  return {
    changesMade: output.changesMade,
    assumptions: output.assumptions,
    decisionsTaken: output.decisionsTaken,
    pointsOfUnclarity: output.pointsOfUnclarity,
    testsRun: output.testsRun,
  };
}

function formatThoughtsSection(thoughts: ThoughtFields): string {
  const header = "AI Thoughts\n-----------";

  const entries: Array<[string, string]> = [
    ["Changes made", thoughts.changesMade],
    ["Assumptions", thoughts.assumptions],
    ["Decisions taken", thoughts.decisionsTaken],
    ["Points of unclarity", thoughts.pointsOfUnclarity],
    ["Tests run", thoughts.testsRun],
  ];

  const sections = entries.map(([label, content]) => {
    const dashes = "-".repeat(label.length);
    const trimmed = content.trim();
    return trimmed ? `${label}\n${dashes}\n${trimmed}` : `${label}\n${dashes}`;
  });

  return [header, ...sections].join("\n\n");
}
