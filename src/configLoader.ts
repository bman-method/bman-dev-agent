import fs from "node:fs";
import path from "node:path";
import { AgentConfig, AgentName, AgentRegistryEntry, Config, ConfigLoader } from "./types";
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

    const agentConfig = buildAgentConfig(fileConfig.agent);
    const tasksFile =
      fileConfig.tasksFile ?? getDefaultTasksFilePath(trimmedBranchName, configDir);
    const outputDir = fileConfig.outputDir ?? path.join(configDir, "output");

    ensureDirectory(resolveDir(outputDir));
    ensureDirectory(path.dirname(resolvePath(tasksFile)));

    return {
      agent: agentConfig,
      tasksFile,
      outputDir,
    };
  }

  validate(config: Config): void {
    validateAgentConfig(config.agent);

    if (!isNonEmptyString(config.tasksFile)) {
      throw new Error("tasksFile must be a non-empty string.");
    }

    if (!isNonEmptyString(config.outputDir)) {
      throw new Error("outputDir must be a non-empty string.");
    }

    validateRegistryEntries(config.agent.registry);
  }
}

type FileConfig = Partial<Omit<Config, "agent">> & {
  agent?: unknown;
};

function readConfigFile(resolvedPath: string): FileConfig {
  if (!fs.existsSync(resolvedPath)) {
    return {};
  }

  const content = fs.readFileSync(resolvedPath, "utf8");
  return JSON.parse(content) as FileConfig;
}

function buildAgentConfig(rawAgent: unknown): AgentConfig {
  const agentObject = isPlainObject(rawAgent) ? (rawAgent as Record<string, unknown>) : {};
  const defaultAgent = normalizeAgentName(agentObject.default);
  const registry = buildRegistry(agentObject.registry);

  return {
    default: defaultAgent,
    registry,
  };
}

const BUILTIN_REGISTRY: Record<string, AgentRegistryEntry> = {
  codex: {
    cmd: ["codex", "exec", "--sandbox", "workspace-write", "--skip-git-repo-check", "-"],
  },
  gemini: {
    cmd: ["gemini", "--approval-mode", "auto_edit"],
  },
  claude: {
    cmd: ["claude", "--allowedTools", "Read,Write,Bash", "--output-format", "json", "-p", "--verbose"],
  },
};

function buildRegistry(rawRegistry: unknown): Record<string, AgentRegistryEntry> {
  const registry: Record<string, AgentRegistryEntry> = { ...BUILTIN_REGISTRY };
  if (!isPlainObject(rawRegistry)) {
    return registry;
  }
  for (const [rawKey, value] of Object.entries(rawRegistry)) {
    const key = normalizeRegistryKey(rawKey);
    if (!key) {
      continue;
    }
    const entry = isPlainObject(value) ? (value as Record<string, unknown>) : {};
    const cmd = normalizeCmd(entry.cmd);
    registry[key] = { cmd: cmd ?? [] };
  }
  return registry;
}

function ensureDirectory(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function normalizeAgentName(agent: unknown): AgentName {
  if (typeof agent !== "string") {
    return "codex";
  }
  const normalized = agent.trim().toLowerCase();
  return normalized || "codex";
}

function normalizeRegistryKey(key: string): string {
  return key.trim().toLowerCase();
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every((item) => isNonEmptyString(item));
}

function normalizeCmd(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const trimmed = value.map((item) => (typeof item === "string" ? item.trim() : ""));
  if (!isNonEmptyStringArray(trimmed)) {
    return null;
  }
  return trimmed;
}

function resolveDir(dir: string): string {
  return path.isAbsolute(dir) ? dir : path.resolve(dir);
}

function resolvePath(filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
}

function validateAgentConfig(config: AgentConfig): void {
  if (!isNonEmptyString(config.default)) {
    throw new Error("agent.default must be a non-empty string.");
  }

  if (!isPlainObject(config.registry)) {
    throw new Error("agent.registry must be an object.");
  }

  if (!(config.default in config.registry)) {
    throw new Error(`agent.default "${config.default}" is not defined in agent.registry.`);
  }
}

function validateRegistryEntries(registry: Record<string, AgentRegistryEntry>): void {
  const keys = Object.keys(registry);
  for (const key of keys) {
    const entry = registry[key];
    if (!entry || !isNonEmptyStringArray(entry.cmd)) {
      throw new Error(`agent.registry.${key}.cmd must be a non-empty array of strings.`);
    }
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
