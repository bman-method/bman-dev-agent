import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { AgentConfig, AgentName, AgentRegistryEntry, CodeAgent, RunContext } from "./types";

interface CLIAgentOptions {
    name?: AgentName;
    agentConfig?: AgentConfig;
    command?: string;
    args?: string[];
    defaultArgs?: string[];
    env?: NodeJS.ProcessEnv;
}

const DEFAULT_CODEX_ARGS = ["exec", "--sandbox", "workspace-write", "--skip-git-repo-check", "-"];

const DEFAULT_AGENT_REGISTRY: Record<string, AgentRegistryEntry> = {
    codex: {
        cmd: ["codex", ...DEFAULT_CODEX_ARGS],
    },
    gemini: {
        cmd: ["gemini", "--approval-mode", "auto_edit"],
    },
    claude: {
        cmd: ["claude", "--allowedTools", "Read,Write,Bash", "--output-format", "json", "-p", "--verbose"],
    },
};

export class CLIAgent implements CodeAgent {
    static resolveName(agentOption: string | undefined, agentConfig?: AgentConfig): AgentName {
        const registry = mergeRegistry(agentConfig?.registry);
        const requested = normalizeAgentOption(agentOption, registry);
        if (requested) {
            return requested;
        }

        const fallback = normalizeAgentName(agentConfig?.default);
        if (!registry[fallback]) {
            const available = Object.keys(registry).sort().join(", ");
            throw new Error(`Default agent "${fallback}" is not defined. Available agents: ${available}`);
        }
        return fallback;
    }

    static defaultRegistry(): Record<string, AgentRegistryEntry> {
        return { ...DEFAULT_AGENT_REGISTRY };
    }

    name: string;
    private readonly command: string;
    private readonly args: string[];

    constructor(private readonly options: CLIAgentOptions = {}) {
        const { name, command, args } = resolveCommand(options);
        this.name = name;
        this.command = command;
        this.args = args;
    }

    async run(prompt: string, ctx: RunContext): Promise<void> {
        ensureDirectoryFor(ctx.outputPath);
        const logPath = buildLogPath(ctx, this.name);
        ensureDirectoryFor(logPath);
        console.log(`${this.name}: running ${this.command} and writing logs to ${logPath}`);
        // Default to non-interactive mode, reading prompt from stdin.
        const command = this.command;
        const args = this.args;
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
                        finish(new Error(`${this.name} agent exited with code ${code ?? "null"}${signal ? ` (signal ${signal})` : ""}`));
                        return;
                    }
                    if (!fs.existsSync(ctx.outputPath)) {
                        finish(new Error(`${this.name} agent did not write output to ${ctx.outputPath}`));
                        return;
                    }
                    finish();
                });
            });
        });
    }
}

function resolveCommand(options: CLIAgentOptions): { name: string; command: string; args: string[] } {
    const name = options.name ?? options.agentConfig?.default ?? "codex";

    if (options.command) {
        const fallbackArgs =
            options.defaultArgs ??
            (options.command === "codex" && !options.args ? DEFAULT_CODEX_ARGS : []);
        return { name, command: options.command, args: options.args ?? fallbackArgs };
    }

    const registry = mergeRegistry(options.agentConfig?.registry);
    const entry = registry[name];
    const parts = (entry?.cmd ?? []).map((part) => part.trim()).filter((part) => part.length > 0);
    const [command, ...args] = parts;
    if (!command) {
        throw new Error(
            `Agent "${name}" is missing a command. Configure agent.registry.${name}.cmd in .bman/config.json.`
        );
    }
    return { name, command, args };
}

function normalizeAgentName(agent: string | undefined): string {
    if (!agent) {
        return "codex";
    }
    const normalized = agent.trim().toLowerCase();
    return normalized || "codex";
}

function normalizeAgentOption(
    agent: string | undefined,
    registry: Record<string, AgentRegistryEntry>
): AgentName | null {
    if (!agent) {
        return null;
    }
    const lowered = agent.trim().toLowerCase();
    if (registry[lowered]) {
        return lowered;
    }
    const available = Object.keys(registry).sort().join(", ");
    throw new Error(`Unsupported agent "${agent}". Available agents: ${available}`);
}

function mergeRegistry(
    registry: Record<string, AgentRegistryEntry> | undefined
): Record<string, AgentRegistryEntry> {
    if (!registry || Object.keys(registry).length === 0) {
        return { ...DEFAULT_AGENT_REGISTRY };
    }
    return { ...DEFAULT_AGENT_REGISTRY, ...registry };
}

function ensureDirectoryFor(filePath: string): void {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
}

function buildLogPath(ctx: RunContext, agentName: string): string {
    const outputRoot = path.dirname(path.dirname(ctx.outputPath));
    return path.join(outputRoot, "logs", `${agentName}-${ctx.taskId}-${ctx.timestamp}.log`);
}
