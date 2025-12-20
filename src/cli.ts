#!/usr/bin/env node
import path from "node:path";
import { CLIAgent } from "./codeAgent";
import { DefaultCommitMessageFormatter } from "./commitMessageFormatter";
import { DefaultConfigLoader } from "./configLoader";
import { DefaultGitOps } from "./gitOps";
import { DefaultOrchestratorFactory } from "./orchestrator";
import { DefaultOutputContract } from "./outputContract";
import { DefaultPromptStrategy } from "./promptStrategy";
import { DefaultResultParser } from "./resultParser";
import { DefaultRunContextFactory } from "./runContextFactory";
import { DefaultTaskTracker } from "./taskTracker";
import {
  CLI,
  CLIOptions,
  CLICommand,
  Config,
  ConfigLoader,
  GitOps,
  Orchestrator,
  OrchestratorDeps,
  OrchestratorFactory,
  TaskTrackerDocument,
  TaskTracker,
  AgentName,
  CodeAgent,
  AgentRegistryEntry,
} from "./types";

interface CLIOverrides {
  orchestrator?: Orchestrator;
  orchestratorFactory?: OrchestratorFactory;
  configLoader?: ConfigLoader;
  taskTracker?: TaskTracker;
  git?: GitOps;
}

type TaskContext = {
  configLoader: ConfigLoader;
  config: Config;
  taskTracker: TaskTracker;
  document: TaskTrackerDocument;
};

export class UsageError extends Error {}

export class DefaultCLI implements CLI {
  constructor(private readonly overrides: CLIOverrides = {}) {}

  async run(options: CLIOptions): Promise<void> {
    if (options.help) {
      printUsage();
      return;
    }

    if (!options.command) {
      throw new UsageError("No command provided.");
    }

    const git = this.overrides.git ?? new DefaultGitOps(process.cwd(), options.push === true);
    const branchName = this.getBranchNameOrExit(git);
    if (!branchName) {
      return;
    }

    if (options.command === "add-task") {
      this.handleAddTask(branchName, options);
      return;
    }

    if (options.command !== "resolve") {
      throw new UsageError(`Unknown command "${options.command}".`);
    }

    const { configLoader, config, taskTracker, document } = this.loadTaskContext(branchName);
    const agentName = this.resolveAgent(options.agent, config);

    const hasBlockedTask = document.tasks.some((task) => task.status === "blocked");
    if (hasBlockedTask) {
      console.error("Blocked tasks present. Resolve blocked tasks before starting new work.");
      process.exitCode = 1;
      return;
    }

    const hasOpenTask = taskTracker.pickNextTask(document.tasks) !== null;
    if (!hasOpenTask) {
      console.error("No open tasks found. Nothing to run.");
      return;
    }

    const orchestrator =
      this.overrides.orchestrator ??
      this.createOrchestrator(branchName, configLoader, taskTracker, git, agentName, config);

    if (options.all) {
      await orchestrator.runAll();
      return;
    }

    await orchestrator.runOnce();
  }

  private loadTaskContext(branchName: string): TaskContext {
    const configLoader = this.overrides.configLoader ?? new DefaultConfigLoader();
    const config = configLoader.load(branchName);
    configLoader.validate(config);

    const taskTracker = this.overrides.taskTracker ?? new DefaultTaskTracker(config.tasksFile);
    const document = taskTracker.loadDocument();

    return { configLoader, config, taskTracker, document };
  }

  private createOrchestrator(
    branchName: string,
    configLoader: ConfigLoader,
    taskTracker: TaskTracker,
    git: GitOps,
    agentName: AgentName,
    config: Config
  ): Orchestrator {
    const resolvedConfigLoader = configLoader ?? this.overrides.configLoader ?? new DefaultConfigLoader();
    const resolvedGit = git ?? this.overrides.git ?? new DefaultGitOps(process.cwd());
    const resolvedTaskTracker =
      taskTracker ??
      this.overrides.taskTracker ??
      (() => {
        const trackerConfig = config ?? resolvedConfigLoader.load(branchName);
        resolvedConfigLoader.validate(trackerConfig);
        return new DefaultTaskTracker(trackerConfig.tasksFile);
      })();
    const resolvedConfig = config ?? resolvedConfigLoader.load(branchName);
    resolvedConfigLoader.validate(resolvedConfig);

    const deps: OrchestratorDeps = {
      configLoader: resolvedConfigLoader,
      branchName,
      taskTracker: resolvedTaskTracker,
      promptStrategy: new DefaultPromptStrategy(),
      runContextFactory: new DefaultRunContextFactory(),
      contract: DefaultOutputContract,
      agent: this.createAgent(agentName, resolvedConfig),
      resultParser: new DefaultResultParser(),
      commitFormatter: new DefaultCommitMessageFormatter(),
      git: resolvedGit,
    };

    const factory = this.overrides.orchestratorFactory ?? new DefaultOrchestratorFactory();
    return factory.create(deps);
  }

  private resolveAgent(agentOption: string | undefined, config: Config): AgentName {
    const requested = this.normalizeAgent(agentOption, config.agent.registry);
    if (requested) {
      return requested;
    }

    const fallback = config.agent.default;
    if (!config.agent.registry[fallback]) {
      throw new UsageError(
        `Default agent "${fallback}" is not defined in agent.registry.`
      );
    }
    return fallback;
  }

  private normalizeAgent(
    agent: string | undefined,
    registry: Record<string, AgentRegistryEntry>
  ): AgentName | null {
    if (!agent) {
      return null;
    }
    const lowered = agent.toLowerCase();
    if (registry[lowered]) {
      return lowered;
    }
    const available = Object.keys(registry).sort().join(", ");
    throw new UsageError(`Unsupported agent "${agent}". Available agents: ${available}`);
  }

  private createAgent(agentName: AgentName, config: Config): CodeAgent {
    const entry = config.agent.registry[agentName];
    const parts = (entry?.cmd ?? []).map((part) => part.trim()).filter((part) => part.length > 0);
    const [command, ...args] = parts;
    if (!command) {
      throw new UsageError(
        `Agent "${agentName}" is missing a command. Configure agent.registry.${agentName}.cmd in .bman/config.json.`
      );
    }
    return new CLIAgent({ name: agentName, command, args });
  }

  private handleAddTask(branchName: string, options: CLIOptions): void {
    const description = options.taskDescription?.trim();
    if (!description) {
      throw new UsageError("Task description is required for add-task.");
    }

    const configLoader = this.overrides.configLoader ?? new DefaultConfigLoader();
    const config = configLoader.load(branchName);
    configLoader.validate(config);

    const taskTracker = this.overrides.taskTracker ?? new DefaultTaskTracker(config.tasksFile);
    const task = taskTracker.addTask(description);

    const resolvedPath = path.resolve(config.tasksFile);
    console.log(`Added task ${task.id} to ${resolvedPath}`);
  }

  private getBranchNameOrExit(git: GitOps): string | null {
    try {
      return git.getCurrentBranchName();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Git is required to run bman-dev-agent: ${message}`);
      process.exitCode = 1;
      return null;
    }
  }
}

export function parseArgs(argv: string[]): CLIOptions {
  const options: CLIOptions = {};
  let command: CLICommand | undefined;

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (!arg.startsWith("-")) {
      if (command) {
        if (command === "add-task" && options.taskDescription === undefined) {
          options.taskDescription = arg;
          continue;
        }
        throw new UsageError(`Unexpected argument: ${arg}`);
      }
      command = parseCommand(arg);
      continue;
    }

    if (arg === "--all" || arg === "-a") {
      options.all = true;
      continue;
    }

    if (arg === "--agent") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error("Missing value for --agent");
      }
      options.agent = value;
      i++;
      continue;
    }

    if (arg.startsWith("--agent=")) {
      options.agent = arg.split("=", 2)[1] ?? "";
      continue;
    }

    if (arg === "--push") {
      options.push = true;
      continue;
    }

    throw new UsageError(`Unknown argument: ${arg}`);
  }

  if (command) {
    validateOptionsForCommand(command, options);
  }

  if (!options.help && !command) {
    throw new UsageError("No command provided.");
  }

  options.command = command;
  return options;
}

function parseCommand(value: string): CLICommand {
  if (value === "resolve") {
    return "resolve";
  }
  if (value === "add-task") {
    return "add-task";
  }
  throw new UsageError(`Unknown command "${value}".`);
}

function validateOptionsForCommand(command: CLICommand, options: CLIOptions): void {
  if (command !== "resolve") {
    if (options.all) {
      throw new UsageError("--all is only valid for the resolve command.");
    }
    if (options.push) {
      throw new UsageError("--push is only valid for the resolve command.");
    }
    if (options.agent !== undefined) {
      throw new UsageError("--agent is only valid for the resolve command.");
    }
  }
}

export async function main(): Promise<void> {
  try {
    const options = parseArgs(process.argv);
    const cli = new DefaultCLI();
    await cli.run(options);
  } catch (err) {
    // Print a concise error; callers rely on non-zero exit to detect failure.
    const message = err instanceof Error ? err.message : String(err);
    console.error(message);
    if (err instanceof UsageError) {
      printUsage();
    }
    process.exitCode = 1;
  }
}

if (require.main === module) {
  void main();
}

function printUsage(): void {
  const usage = `
Usage: bman-dev-agent <command> [options]

Commands:
  resolve [options]
                  Resolve tasks using the configured agent
    --all, -a     Run all tasks sequentially
    --agent <name>
                  Agent name from agent.registry (default from config)
    --push        Push commits after each task (opt-in)

  add-task <description>
                  Append a new open task to the current branch tracker

Global options:
  --help, -h      Show this help message
`.trim();
  console.error(usage);
}
