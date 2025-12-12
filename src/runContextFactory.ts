import fs from "node:fs";
import path from "node:path";
import { Config, RunContext, RunContextFactory, Task } from "./types";

export class DefaultRunContextFactory implements RunContextFactory {
  create(task: Task, attempt: number, config: Config): RunContext {
    const runId = createRunId();
    const dir = path.join(config.outputDir, task.id);
    fs.mkdirSync(dir, { recursive: true });

    const outputPath = path.join(dir, `${runId}.json`);

    return {
      runId,
      taskId: task.id,
      attempt,
      outputPath,
    };
  }
}

function createRunId(): string {
  const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, "");
  const random = Math.random().toString(36).slice(2, 8);
  return `run-${timestamp}-${random}`;
}
