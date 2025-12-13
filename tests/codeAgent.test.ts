import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";
import * as childProcess from "node:child_process";
import { RunContext } from "../src/types";

function withTempDir<T>(fn: (dir: string) => T): T {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-agent-"));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function buildCtx(outputPath: string, runId = "run-20240101000000000-abc123"): RunContext {
  return {
    runId,
    taskId: "TASK-1",
    attempt: 1,
    outputPath,
  };
}

function buildLogPath(ctx: RunContext): string {
  const outputRoot = path.dirname(path.dirname(ctx.outputPath));
  const timestamp = ctx.runId.match(/^run-([^-]+)/)?.[1] ?? "unknown";
  return path.join(outputRoot, "logs", `codex-${ctx.taskId}-${timestamp}.log`);
}

describe("CodexAgent", () => {
  it("uses default codex exec flags when args are not provided and writes logs to a file", async () => {
    await withTempDir(async (dir) => {
      const outputPath = path.join(dir, "TASK-1", "result.json");
      const ctx = buildCtx(outputPath, "run-20240101120000000-abc123");
      const prompt = "Default flags prompt";

      const expectedArgs = [
        "exec",
        "--sandbox",
        "workspace-write",
        "--skip-git-repo-check",
        "-",
      ];

      jest.resetModules();
      const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
      const spawnMock = jest.fn((_command: any, args: any, options: any) => {
        expect(args).toEqual(expectedArgs);
        expect(options.stdio).toEqual(["pipe", "pipe", "pipe"]);

        const emitter = new EventEmitter() as any;
        const stdout = new EventEmitter() as any;
        const stderr = new EventEmitter() as any;
        const chunks: string[] = [];

        stdout.pipe = jest.fn((dest: any) => {
          stdout.on("data", (data: Buffer) => dest.write(data));
          return dest;
        });
        stderr.pipe = jest.fn((dest: any) => {
          stderr.on("data", (data: Buffer) => dest.write(data));
          return dest;
        });

        emitter.stdout = stdout;
        emitter.stderr = stderr;
        emitter.stdin = {
          write: (chunk: string) => chunks.push(chunk),
          end: () => {
            const out = options.env.OUTPUT_PATH;
            fs.mkdirSync(path.dirname(out), { recursive: true });
            fs.writeFileSync(out, JSON.stringify({ args, received: chunks.join("").trim() }));
            setImmediate(() => {
              stdout.emit("data", Buffer.from("stdout log line"));
              stderr.emit("data", Buffer.from("stderr log line"));
              emitter.emit("close", 0, null);
            });
          },
        };

        return emitter;
      });

      jest.doMock("node:child_process", () => ({
        ...jest.requireActual("node:child_process"),
        spawn: spawnMock,
      }));

      const { CodexAgent } = await import("../src/codeAgent");

      const agent = new CodexAgent({
        command: "codex", // value irrelevant due to mock
      });

      try {
        await agent.run(prompt, ctx);

        const saved = JSON.parse(fs.readFileSync(outputPath, "utf8")) as {
          args: string[];
          received: string;
        };
        expect(saved.received).toBe(prompt);
        expect(saved.args).toEqual(expectedArgs);

        const logPath = buildLogPath(ctx);
        const logContent = fs.readFileSync(logPath, "utf8");
        expect(logContent).toContain("stdout log line");
        expect(logContent).toContain("stderr log line");
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining(`writing logs to ${logPath}`)
        );
      } finally {
        consoleSpy.mockRestore();
        jest.dontMock("node:child_process");
        jest.resetModules();
      }
    });
  });

  it("sends prompt to the command and requires output file", async () => {
    await withTempDir(async (dir) => {
      const { CodexAgent } = await import("../src/codeAgent");
      const outputPath = path.join(dir, "TASK-1", "result.json");
      const prompt = "Do the thing";

      const script = `
        const fs = require("node:fs");
        const path = require("node:path");
        const out = process.env.OUTPUT_PATH;
        const input = fs.readFileSync(0, "utf8");
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, JSON.stringify({ received: input.trim() }));
        process.stdout.write("log from stdout");
        process.stderr.write("log from stderr");
      `;

      const agent = new CodexAgent({
        command: process.execPath,
        args: ["-e", script],
      });

      const ctx = buildCtx(outputPath, "run-20240202101010101-zzz111");
      await agent.run(prompt, ctx);

      const saved = JSON.parse(fs.readFileSync(outputPath, "utf8")) as { received: string };
      expect(saved.received).toBe(prompt);

      const logPath = buildLogPath(ctx);
      const content = fs.readFileSync(logPath, "utf8");
      expect(content).toContain("log from stdout");
      expect(content).toContain("log from stderr");
    });
  });

  it("throws when the command exits with non-zero code", async () => {
    await withTempDir(async (dir) => {
      const { CodexAgent } = await import("../src/codeAgent");
      const outputPath = path.join(dir, "TASK-1", "result.json");

      const agent = new CodexAgent({
        command: process.execPath,
        args: ["-e", "process.exit(3)"],
      });

      await expect(agent.run("prompt", buildCtx(outputPath))).rejects.toThrow(/exited with code 3/);
    });
  });

  it("throws when the command does not write the output file", async () => {
    await withTempDir(async (dir) => {
      const { CodexAgent } = await import("../src/codeAgent");
      const outputPath = path.join(dir, "TASK-1", "result.json");

      const agent = new CodexAgent({
        command: process.execPath,
        args: ["-e", "process.exit(0)"],
      });

      await expect(agent.run("prompt", buildCtx(outputPath))).rejects.toThrow(
        /did not write output/
      );
    });
  });
});
