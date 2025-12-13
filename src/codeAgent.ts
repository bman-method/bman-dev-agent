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
    constructor(private readonly options: CodexAgentOptions = {}) { }
    async run(prompt: string, ctx: RunContext): Promise<void> {
        ensureDirectoryFor(ctx.outputPath);
        const logPath = buildLogPath(ctx);
        ensureDirectoryFor(logPath);
        console.log(`CodexAgent: running codex and writing logs to ${logPath}`);
        const command = this.options.command ?? "codex";
        // Default to non-interactive mode, reading prompt from stdin.
        const args = this.options.args ??
            ["exec", "--sandbox", "workspace-write", "--skip-git-repo-check", "-"];
        const env = { ...process.env, ...this.options.env, OUTPUT_PATH: ctx.outputPath };
        await new Promise<void>((resolve, reject) => {
            let settled = false;
            const finish = (err?: Error): void => {
                if (settled) {
                    return;
                }
                settled = true;
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            };
            const logStream = fs.createWriteStream(logPath, { flags: "w" });
            logStream.on("error", (err) => finish(err));
            const child = spawn(command, args, {
                env,
                stdio: ["pipe", "pipe", "pipe"],
            });
            child.on("error", (err) => {
                logStream.end(() => finish(err));
            });
            child.stdout?.pipe(logStream, { end: false });
            child.stderr?.pipe(logStream, { end: false });
            child.stdin.write(prompt);
            child.stdin.end();
            child.on("close", (code, signal) => {
                logStream.end(() => {
                    if (code !== 0) {
                        finish(new Error(`Codex agent exited with code ${code ?? "null"}${signal ? ` (signal ${signal})` : ""}`));
                        return;
                    }
                    if (!fs.existsSync(ctx.outputPath)) {
                        finish(new Error(`Codex agent did not write output to ${ctx.outputPath}`));
                        return;
                    }
                    finish();
                });
            });
        });
    }
}
function ensureDirectoryFor(filePath: string): void {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
}
function buildLogPath(ctx: RunContext): string {
    const outputRoot = path.dirname(path.dirname(ctx.outputPath));
    const timestamp = extractTimestampFromRunId(ctx.runId);
    return path.join(outputRoot, "logs", `codex-${ctx.taskId}-${timestamp}.log`);
}
function extractTimestampFromRunId(runId: string): string {
    const match = /^run-([^-]+)/.exec(runId);
    if (match?.[1]) {
        return match[1];
    }
    return new Date().toISOString().replace(/[-:TZ.]/g, "");
}
