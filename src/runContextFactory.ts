import fs from "node:fs";
import path from "node:path";
import { Config, RunContext, RunContextFactory, Task } from "./types";

export class DefaultRunContextFactory implements RunContextFactory {
  create(task: Task, attempt: number, config: Config): RunContext {
    const timestamp = createTimestamp();
    const runId = createRunId(timestamp);
    const dir = path.join(config.outputDir, task.id);
    fs.mkdirSync(dir, { recursive: true });

    const outputPath = path.join(dir, `${runId}.json`);

    return {
      runId,
      timestamp,
      taskId: task.id,
      attempt,
      outputPath,
    };
  }
}

function createRunId(timestamp: string): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `run-${timestamp}-${random}`;
}

function createTimestamp(): string {
  return new Date().toISOString().replace(/[-:TZ.]/g, "");
}
