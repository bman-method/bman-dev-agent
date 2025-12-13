#!/usr/bin/env node
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
  ConfigLoader,
  Orchestrator,
  OrchestratorDeps,
  OrchestratorFactory,
  TaskTrackerDocument,
  TaskTracker,
} from "./types";

interface CLIOverrides {
  orchestrator?: Orchestrator;
  orchestratorFactory?: OrchestratorFactory;
  configLoader?: ConfigLoader;
  taskTracker?: TaskTracker;
}

export class DefaultCLI implements CLI {
  constructor(private readonly overrides: CLIOverrides = {}) {}

  async run(options: CLIOptions): Promise<void> {
    if (options.help) {
      printUsage();
      return;
    }

    const agentName = (options.agent ?? "codex").toLowerCase();
    if (agentName !== "codex") {
      throw new Error(`Unsupported agent "${options.agent}". Only "codex" is supported.`);
    }

    const { configLoader, taskTracker, document } = this.loadTaskContext();

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
      this.overrides.orchestrator ?? this.createOrchestrator(configLoader, taskTracker);

    if (options.all) {
      await orchestrator.runAll();
      return;
    }

    await orchestrator.runOnce();
  }

  private loadTaskContext(): {
    configLoader: ConfigLoader;
    taskTracker: TaskTracker;
    document: TaskTrackerDocument;
  } {
    const configLoader = this.overrides.configLoader ?? new DefaultConfigLoader();
    const config = configLoader.load();
    configLoader.validate(config);

    const taskTracker = this.overrides.taskTracker ?? new DefaultTaskTracker(config.tasksFile);
    const document = taskTracker.loadDocument();

    return { configLoader, taskTracker, document };
  }

  private createOrchestrator(
    configLoader?: ConfigLoader,
    taskTracker?: TaskTracker
  ): Orchestrator {
    const resolvedConfigLoader = configLoader ?? this.overrides.configLoader ?? new DefaultConfigLoader();
    const config = resolvedConfigLoader.load();
    resolvedConfigLoader.validate(config);

    const resolvedTaskTracker =
      taskTracker ?? this.overrides.taskTracker ?? new DefaultTaskTracker(config.tasksFile);

    const deps: OrchestratorDeps = {
      configLoader: resolvedConfigLoader,
      taskTracker: resolvedTaskTracker,
      promptStrategy: new DefaultPromptStrategy(),
      runContextFactory: new DefaultRunContextFactory(),
      contract: DefaultOutputContract,
      agent: new CodexAgent(),
      resultReader: new DefaultResultReader(),
      resultValidator: new DefaultResultValidator(),
      commitFormatter: new DefaultCommitMessageFormatter(),
      git: new DefaultGitOps(),
    };

    const factory = this.overrides.orchestratorFactory ?? new DefaultOrchestratorFactory();
    return factory.create(deps);
  }
}

export function parseArgs(argv: string[]): CLIOptions {
  const options: CLIOptions = {};

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
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

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
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
    printUsage();
    process.exitCode = 1;
  }
}

if (require.main === module) {
  void main();
}

function printUsage(): void {
  const usage = `
Usage: bman-dev-agent [options]

Options:
  --all, -a       Run all tasks sequentially
  --agent <name>  Agent name (only "codex" supported; default: codex)
  --help, -h      Show this help message
`.trim();
  console.error(usage);
}
