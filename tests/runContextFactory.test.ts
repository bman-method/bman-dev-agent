import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DefaultRunContextFactory } from "../src/runContextFactory";
import { Task } from "../src/types";

const task: Task = {
  id: "TASK-1",
  title: "Sample task",
  description: "Do something",
  status: "open",
};

function withTempDir(fn: (dir: string) => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "runctx-"));
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe("DefaultRunContextFactory", () => {
  it("creates a run context with unique runId and output path under the outputDir/task", () => {
    withTempDir((outDir) => {
      const factory = new DefaultRunContextFactory();
      const ctx1 = factory.create(task, 1, {
        agent: "codex",
        tasksFile: "tasks.md",
        outputDir: outDir,
      });
      const ctx2 = factory.create(task, 2, {
        agent: "codex",
        tasksFile: "tasks.md",
        outputDir: outDir,
      });

      expect(ctx1.runId).not.toBe(ctx2.runId);
      expect(ctx1.taskId).toBe(task.id);
      expect(ctx1.attempt).toBe(1);
      expect(ctx1.outputPath).toMatch(new RegExp(`${task.id}/.+\\.json$`));
      expect(fs.existsSync(path.dirname(ctx1.outputPath))).toBe(true);
      expect(fs.existsSync(path.dirname(ctx2.outputPath))).toBe(true);
    });
  });
});
