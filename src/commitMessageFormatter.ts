import { AgentOutput, CommitMessageFormatter, Task } from "./types";

export class DefaultCommitMessageFormatter implements CommitMessageFormatter {
  formatTitle(task: Task, output: AgentOutput): string {
    const statusPrefix = output.status === "success" ? "" : `[${output.status}] `;
    return `${statusPrefix}${task.id} - ${output.commitMessage || task.title}`.trim();
  }

  formatBody(task: Task, output: AgentOutput): string {
    const humanMessage = output.commitMessage.trim() || task.title;
    const thoughts = output.aiThoughts.trim();

    const sections = [`Task: ${task.id} - ${task.title}`, `Message: ${humanMessage}`];

    if (thoughts) {
      sections.push("---", "AI Thoughts:", thoughts);
    }

    return sections.join("\n");
  }
}
