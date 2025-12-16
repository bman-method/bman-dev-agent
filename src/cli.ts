#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { CodexAgent } from "./codeAgent";
import { DefaultCommitMessageFormatter } from "./commitMessageFormatter";
import { DefaultConfigLoader } from "./configLoader";
import { DefaultGitOps } from "./gitOps";
import { DefaultOrchestratorFactory } from "./orchestrator";
import { DefaultOutputContract } from "./outputContract";
import { DefaultPromptStrategy } from "./promptStrategy";
import { DefaultResultReader } from "./resultReader";
import { DefaultResultValidator } from "./resultValidator";
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
  Task,
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
      this.addTask(branchName, options);
      return;
    }

    if (options.command !== "resolve") {
      throw new UsageError(`Unknown command "${options.command}".`);
    }

    const agentName = (options.agent ?? "codex").toLowerCase();
    if (agentName !== "codex") {
      throw new UsageError(`Unsupported agent "${options.agent}". Only "codex" is supported.`);
    }

    const { configLoader, taskTracker, document } = this.loadTaskContext(branchName);

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
      this.createOrchestrator(branchName, configLoader, taskTracker, git);

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
    git: GitOps
  ): Orchestrator {
    const resolvedConfigLoader = configLoader ?? this.overrides.configLoader ?? new DefaultConfigLoader();
    const resolvedGit = git ?? this.overrides.git ?? new DefaultGitOps(process.cwd());
    const resolvedTaskTracker =
      taskTracker ??
      this.overrides.taskTracker ??
      (() => {
        const trackerConfig = resolvedConfigLoader.load(branchName);
        resolvedConfigLoader.validate(trackerConfig);
        return new DefaultTaskTracker(trackerConfig.tasksFile);
      })();

    const deps: OrchestratorDeps = {
      configLoader: resolvedConfigLoader,
      branchName,
      taskTracker: resolvedTaskTracker,
      promptStrategy: new DefaultPromptStrategy(),
      runContextFactory: new DefaultRunContextFactory(),
      contract: DefaultOutputContract,
      agent: new CodexAgent(),
      resultReader: new DefaultResultReader(),
      resultValidator: new DefaultResultValidator(),
      commitFormatter: new DefaultCommitMessageFormatter(),
      git: resolvedGit,
    };

    const factory = this.overrides.orchestratorFactory ?? new DefaultOrchestratorFactory();
    return factory.create(deps);
  }

  private addTask(branchName: string, options: CLIOptions): void {
    const description = options.taskDescription?.trim();
    if (!description) {
      throw new UsageError("Task description is required for add-task.");
    }

    const configLoader = this.overrides.configLoader ?? new DefaultConfigLoader();
    const config = configLoader.load(branchName);
    configLoader.validate(config);

    const taskTracker = this.overrides.taskTracker ?? new DefaultTaskTracker(config.tasksFile);
    const document = this.loadOrInitializeDocument(taskTracker, config.tasksFile);
    const nextTaskId = this.getNextTaskId(document.tasks);

    const updatedDoc: TaskTrackerDocument = {
      ...document,
      tasks: [
        ...document.tasks,
        {
          id: nextTaskId,
          title: description,
          description: "",
          status: "open",
        },
      ],
    };

    taskTracker.saveDocument(updatedDoc);

    const resolvedPath = path.resolve(config.tasksFile);
    console.log(`Added task ${nextTaskId} to ${resolvedPath}`);
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

  private loadOrInitializeDocument(taskTracker: TaskTracker, tasksFile: string): TaskTrackerDocument {
    const resolvedPath = path.resolve(tasksFile);
    if (!fs.existsSync(resolvedPath)) {
      return { preludeText: "", tasks: [] };
    }
    return taskTracker.loadDocument();
  }

  private getNextTaskId(tasks: Task[]): string {
    let lastNumber = 0;
    for (let i = tasks.length - 1; i >= 0; i--) {
      const match = /^TASK-(\d+)$/i.exec(tasks[i].id.trim());
      if (match) {
        lastNumber = parseInt(match[1], 10);
        break;
      }
    }
    const nextNumber = lastNumber + 1;
    return `TASK-${nextNumber}`;
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
  resolve         Resolve tasks using the Codex agent
  add-task <description>
                  Append a new open task to the current branch tracker

Options:
  --all, -a       Run all tasks sequentially
  --agent <name>  Agent name (only "codex" supported; default: codex)
  --push          Push commits after each task (opt-in)
  --help, -h      Show this help message
`.trim();
  console.error(usage);
}
