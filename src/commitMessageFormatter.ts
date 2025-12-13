import { AgentOutput, CommitMessageFormatter, Task } from "./types";

export function deriveHumanMessage(task: Task, output: AgentOutput): string {
  const commitMessage = output.commitMessage.trim();
  if (output.status === "success") {
    return commitMessage || task.title;
  }

  if (commitMessage) {
    return commitMessage;
  }

  const aiThoughts = output.aiThoughts.trim();
  if (aiThoughts) {
    return aiThoughts;
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
    const thoughts = output.aiThoughts.trim();

    const sections = [`Task: ${task.id} - ${task.title}`, `Message: ${humanMessage}`];

    if (thoughts) {
      sections.push("---", "AI Thoughts:", thoughts);
    }

    return sections.join("\n");
  }
}
