import { AiThoughts, AgentOutput, CommitMessageFormatter, Task } from "./types";

export function deriveHumanMessage(task: Task, output: AgentOutput): string {
  const commitMessage = output.commitMessage.trim();
  if (output.status === "success") {
    return commitMessage || task.title;
  }

  if (commitMessage) {
    return commitMessage;
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

export class DefaultCommitMessageFormatter implements CommitMessageFormatter {
  formatTitle(task: Task, output: AgentOutput): string {
    const statusPrefix = output.status === "success" ? "" : `[${output.status}] `;
    const humanMessage = normalizeSingleLine(deriveHumanMessage(task, output));

    return `${statusPrefix}${task.id} - ${humanMessage}`.trim();
  }

  formatBody(task: Task, output: AgentOutput): string {
    const humanMessage = deriveHumanMessage(task, output);
    const thoughts = formatAiThoughts(output.aiThoughts);

    const sections = [`Task: ${task.id} - ${task.title}`, `Message: ${humanMessage}`];

    if (hasAiThoughtContent(output.aiThoughts)) {
      sections.push("---", "AI Thoughts:", thoughts);
    }

    return sections.join("\n");
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

  return entries.map(([label, content]) => `${label}: ${content.trim()}`).join("\n").trim();
}

function hasAiThoughtContent(thoughts: AiThoughts): boolean {
  return Object.values(thoughts).some((value) => value.trim() !== "");
}
