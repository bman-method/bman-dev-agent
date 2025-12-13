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

function buildCtx(outputPath: string): RunContext {
  return {
    runId: "run-1",
    taskId: "TASK-1",
    attempt: 1,
    outputPath,
  };
}

describe("CodexAgent", () => {
  it("uses default codex exec flags when args are not provided", async () => {
    await withTempDir(async (dir) => {
      const outputPath = path.join(dir, "TASK-1", "result.json");
      const prompt = "Default flags prompt";

      const expectedArgs = [
        "exec",
        "--sandbox",
        "workspace-write",
        "--skip-git-repo-check",
        "-",
      ];

      jest.resetModules();
      const spawnMock = jest
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .fn((_command: any, args: any, options: any) => {
          expect(args).toEqual(expectedArgs);

          const emitter = new EventEmitter() as any;
          const chunks: string[] = [];

          emitter.stdin = {
            write: (chunk: string) => chunks.push(chunk),
            end: () => {
              const out = options.env.OUTPUT_PATH;
              fs.mkdirSync(path.dirname(out), { recursive: true });
              fs.writeFileSync(
                out,
                JSON.stringify({ args, received: chunks.join("").trim() })
              );
              setImmediate(() => emitter.emit("close", 0, null));
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

      await agent.run(prompt, buildCtx(outputPath));

      const saved = JSON.parse(fs.readFileSync(outputPath, "utf8")) as {
        args: string[];
        received: string;
      };
      expect(saved.received).toBe(prompt);
      expect(saved.args).toEqual(expectedArgs);

      jest.dontMock("node:child_process");
      jest.resetModules();
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
      `;

      const agent = new CodexAgent({
        command: process.execPath,
        args: ["-e", script],
      });

      await agent.run(prompt, buildCtx(outputPath));

      const saved = JSON.parse(fs.readFileSync(outputPath, "utf8")) as { received: string };
      expect(saved.received).toBe(prompt);
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
