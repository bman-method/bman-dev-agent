import type { AgentOutput, AgentOutputStatus } from "./agentOutputSchema";

export type AgentName = string;

export interface AgentRegistryEntry {
  cmd: string[];
}

export interface AgentConfig {
  default: AgentName;
  registry: Record<string, AgentRegistryEntry>;
}

export interface Config {
  agent: AgentConfig;
  tasksFile: string;
  outputDir: string;
}

export interface ConfigLoader {
  load(branchName: string): Config;
  validate(config: Config): void;
}

export type TaskStatus = "open" | "done" | "blocked";

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
}

export interface TaskTrackerDocument {
  preludeText: string;
  tasks: Task[];
}

export interface TaskTracker {
  loadDocument(): TaskTrackerDocument;
  pickNextTask(tasks: Task[]): Task | null;
  markDone(tasks: Task[], taskId: string): Task[];
  markBlocked(tasks: Task[], taskId: string): Task[];
  saveDocument(doc: TaskTrackerDocument): void;
  addTask(title: string): Task;
}

export interface RunContext {
  runId: string;
  timestamp: string;
  taskId: string;
  attempt: number;
  outputPath: string;
}

export interface RunContextFactory {
  create(task: Task, attempt: number, config: Config): RunContext;
}

export interface OutputContract {
  fields: OutputContractField[];
}

export interface OutputContractField {
  name: string;
  descriptionOfContent: string;
  maxLines?: number;
}

export interface PromptInput {
  task: Task;
  config: Config;
  runContext: RunContext;
  contract: OutputContract;
  trackerDocument: TaskTrackerDocument;
}

export interface PromptStrategy {
  build(input: PromptInput): string;
}

export interface CodeAgent {
  name: string;
  run(prompt: string, ctx: RunContext): Promise<void>;
}

export interface ResultParser {
  readAndValidate(path: string): AgentOutput;
}

export type CommitStatusLabel = "completed" | "blocked";

export interface CommitMessageFormatter {
  formatTitle(task: Task, output: AgentOutput): string;
  formatBody(task: Task, output: AgentOutput): string;
}

export interface GitOps {
  getCurrentBranchName(): string;
  ensureCleanWorkingTree(): void;
  commit(title: string, body: string): string; // returns sha
  push(): void;
}

export interface Orchestrator {
  runOnce(): Promise<void>;
  runAll(): Promise<void>;
}

export interface OrchestratorDeps {
  configLoader: ConfigLoader;
  branchName: string;
  taskTracker: TaskTracker;
  promptStrategy: PromptStrategy;
  runContextFactory: RunContextFactory;
  contract: OutputContract;
  agent: CodeAgent;
  resultParser: ResultParser;
  commitFormatter: CommitMessageFormatter;
  git: GitOps;
}

export interface OrchestratorFactory {
  create(deps: OrchestratorDeps): Orchestrator;
}

export type CLICommand = "resolve" | "add-task";

export interface CLIOptions {
  all?: boolean;
  agent?: string;
  command?: CLICommand;
  help?: boolean;
  push?: boolean;
  taskDescription?: string;
}

export interface CLI {
  run(options: CLIOptions): Promise<void>;
}

export type { AgentOutput, AgentOutputStatus };
