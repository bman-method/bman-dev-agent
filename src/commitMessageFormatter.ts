import { AiThoughts, AgentOutput, CommitMessageFormatter, Task } from "./types";

export function deriveHumanMessage(task: Task, output: AgentOutput): string {
  const commitMessage = output.commitMessage.trim();
  if (commitMessage) {
    return commitMessage;
  }

  if (output.status === "success") {
    return task.title;
  }

  const aiThoughts = output.aiThoughts;
  const formattedThoughts = formatAiThoughts(aiThoughts);
  if (hasAiThoughtContent(aiThoughts)) {
    return formattedThoughts;
  }

  return `Task ended with status: ${output.status}`;
}

function normalizeSingleLine(message: string): string {
  return message.replace(/\s+/g, " ").trim();
}

function parseCommitMessage(message: string): { title: string; body: string } {
  const trimmed = message.trim();
  if (!trimmed) {
    return { title: "", body: "" };
  }

  const [firstLine, ...rest] = trimmed.split(/\r?\n/);
  const title = firstLine.trim();
  const body = rest.join("\n").trim();

  return { title, body };
}

function toStatusLabel(status: AgentOutput["status"]): "completed" | "blocked" {
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
    const thoughts = formatAiThoughts(output.aiThoughts);
    const aiThoughtsSection = formatAiThoughtsSection(output.aiThoughts);

    const sections = [
      (() => {
        const normalized = humanMessage.trim();
        return normalized === thoughts ? "" : normalized;
      })(),
      "---",
      aiThoughtsSection,
      AI_COMMIT_WARNING,
    ].filter((section) => section !== "");

    return sections.join("\n\n");
  }
}

function formatAiThoughts(thoughts: AiThoughts): string {
  const entries: Array<[string, string]> = [
    ["Changes made", thoughts.changesMade],
    ["Assumptions", thoughts.assumptions],
    ["Decisions taken", thoughts.decisionsTaken],
    ["Points of unclarity", thoughts.pointsOfUnclarity],
    ["Tests run", thoughts.testsRun],
  ];

  return entries
    .map(([label, content]) => {
      const trimmed = content.trim();
      return trimmed ? `${label}: ${trimmed}` : `${label}:`;
    })
    .join("\n")
    .trim();
}

function formatAiThoughtsSection(thoughts: AiThoughts): string {
  const entries = [
    "AI Thoughts",
    "-----------",
    ...formatAiThoughts(thoughts).split("\n"),
  ];

  return entries.join("\n");
}

function hasAiThoughtContent(thoughts: AiThoughts): boolean {
  return Object.values(thoughts).some((value) => value.trim() !== "");
}
