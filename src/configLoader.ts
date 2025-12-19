import fs from "node:fs";
import path from "node:path";
import { AgentName, Config, ConfigLoader } from "./types";
import { getDefaultTasksFilePath } from "./tasksFile";

export class DefaultConfigLoader implements ConfigLoader {
  constructor(private readonly configPath: string = path.join(".bman", "config.json")) {}

  load(branchName: string): Config {
    const resolvedPath = path.resolve(this.configPath);
    const configDir = path.dirname(resolvedPath);

    ensureDirectory(configDir);

    const fileConfig = readConfigFile(resolvedPath);
    const trimmedBranchName = branchName.trim();
    if (!fileConfig.tasksFile && !trimmedBranchName) {
      throw new Error("Branch name is required to determine default tasks file path.");
    }

    const defaultAgent = normalizeAgent(fileConfig.defaultAgent ?? fileConfig.agent ?? "codex");
    const customAgentCmd = fileConfig.customAgentCmd;
    const tasksFile =
      fileConfig.tasksFile ?? getDefaultTasksFilePath(trimmedBranchName, configDir);
    const outputDir = fileConfig.outputDir ?? path.join(configDir, "output");

    ensureDirectory(resolveDir(outputDir));
    ensureDirectory(path.dirname(resolvePath(tasksFile)));

    return {
      agent: defaultAgent,
      defaultAgent,
      customAgentCmd,
      tasksFile,
      outputDir,
    };
  }

  validate(config: Config): void {
    validateAgent(config.agent, "agent");
    if (config.defaultAgent) {
      validateAgent(config.defaultAgent, "defaultAgent");
    }
    const effectiveAgent = config.defaultAgent ?? config.agent;
    if (effectiveAgent === "custom" && !isValidCustomAgentCmd(config.customAgentCmd)) {
      throw new Error(
        'customAgentCmd is required when using the "custom" agent. Configure it as a non-empty array in .bman/config.json.'
      );
    }

    if (!isNonEmptyString(config.tasksFile)) {
      throw new Error("tasksFile must be a non-empty string.");
    }

    if (!isNonEmptyString(config.outputDir)) {
      throw new Error("outputDir must be a non-empty string.");
    }
  }
}

function readConfigFile(resolvedPath: string): Partial<Config> {
  if (!fs.existsSync(resolvedPath)) {
    return {};
  }

  const content = fs.readFileSync(resolvedPath, "utf8");
  return JSON.parse(content) as Partial<Config>;
}

function normalizeAgent(agent: unknown): AgentName {
  if (typeof agent !== "string") {
    return "codex";
  }
  const lowered = agent.trim().toLowerCase();
  if (lowered === "custom" || lowered === "codex") {
    return lowered;
  }
  return lowered as AgentName;
}

function validateAgent(agent: AgentName, field: "agent" | "defaultAgent"): void {
  if (agent !== "codex" && agent !== "custom") {
    throw new Error(`Unsupported ${field} "${agent}". Only "codex" or "custom" are supported.`);
  }
}

function ensureDirectory(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every((item) => isNonEmptyString(item));
}

function isValidCustomAgentCmd(value: unknown): value is string[] {
  return isNonEmptyStringArray(value);
}

function resolveDir(dir: string): string {
  return path.isAbsolute(dir) ? dir : path.resolve(dir);
}

function resolvePath(filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
}
