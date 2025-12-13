import fs from "node:fs";
import path from "node:path";
import { Config, ConfigLoader } from "./types";
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

    const agent = (fileConfig.agent ?? "codex").toLowerCase();
    const tasksFile =
      fileConfig.tasksFile ?? getDefaultTasksFilePath(trimmedBranchName, configDir);
    const outputDir = fileConfig.outputDir ?? path.join(configDir, "output");

    ensureDirectory(resolveDir(outputDir));
    ensureDirectory(path.dirname(resolvePath(tasksFile)));

    return {
      agent,
      tasksFile,
      outputDir,
    };
  }

  validate(config: Config): void {
    if (typeof config.agent !== "string" || config.agent.toLowerCase() !== "codex") {
      throw new Error(`Unsupported agent "${config.agent}". Only "codex" is supported.`);
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

function ensureDirectory(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function resolveDir(dir: string): string {
  return path.isAbsolute(dir) ? dir : path.resolve(dir);
}

function resolvePath(filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
}
