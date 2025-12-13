import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { CodeAgent, RunContext } from "./types";

interface CodexAgentOptions {
  command?: string;
  args?: string[];
  env?: NodeJS.ProcessEnv;
}

export class CodexAgent implements CodeAgent {
  name = "codex";

  constructor(private readonly options: CodexAgentOptions = {}) {}

  async run(prompt: string, ctx: RunContext): Promise<void> {
    ensureOutputDirectory(ctx.outputPath);

    const command = this.options.command ?? "codex";
    // Default to non-interactive mode, reading prompt from stdin.
    const args =
      this.options.args ??
      ["exec", "--sandbox", "workspace-write", "--skip-git-repo-check", "-"];
    const env = { ...process.env, ...this.options.env, OUTPUT_PATH: ctx.outputPath };

    await new Promise<void>((resolve, reject) => {
      const child = spawn(command, args, {
        env,
        stdio: ["pipe", "inherit", "inherit"],
      });

      child.on("error", reject);

      child.stdin.write(prompt);
      child.stdin.end();

      child.on("close", (code, signal) => {
        if (code !== 0) {
          reject(
            new Error(
              `Codex agent exited with code ${code ?? "null"}${signal ? ` (signal ${signal})` : ""}`
            )
          );
          return;
        }

        if (!fs.existsSync(ctx.outputPath)) {
          reject(new Error(`Codex agent did not write output to ${ctx.outputPath}`));
          return;
        }

        resolve();
      });
    });
  }
}

function ensureOutputDirectory(outputPath: string): void {
  const dir = path.dirname(outputPath);
  fs.mkdirSync(dir, { recursive: true });
}
