import { AgentOutput, CommitMessageFormatter, Task } from "./types";

type ThoughtFields = Pick<
  AgentOutput,
  "changesMade" | "assumptions" | "decisionsTaken" | "pointsOfUnclarity" | "testsRun"
>;

export function deriveHumanMessage(task: Task, output: AgentOutput): string {
  const commitMessage = output.commitMessage.trim();
  if (commitMessage) {
    return commitMessage;
  }

  if (output.status === "success") {
    return task.title;
  }

  const thoughts = pickThoughts(output);
  const formattedThoughts = formatThoughts(thoughts);
  if (hasThoughtContent(thoughts)) {
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
    const thoughts = pickThoughts(output);
    const thoughtsContent = formatThoughts(thoughts);
    const thoughtsSection = formatThoughtsSection(thoughts);

    const sections = [
      (() => {
        const normalized = humanMessage.trim();
        return normalized === thoughtsContent ? "" : normalized;
      })(),
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

function formatThoughts(thoughts: ThoughtFields): string {
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

function formatThoughtsSection(thoughts: ThoughtFields): string {
  const entries = [
    "AI Thoughts",
    "-----------",
    ...formatThoughts(thoughts).split("\n"),
  ];

  return entries.join("\n");
}

function hasThoughtContent(thoughts: ThoughtFields): boolean {
  return Object.values(thoughts).some((value) => value.trim() !== "");
}
