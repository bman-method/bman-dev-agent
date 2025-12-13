export interface Config {
  agent: string;
  tasksFile: string;
  designFile?: string;
  outputDir: string;
}

export interface ConfigLoader {
  load(): Config;
  validate(config: Config): void;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: "open" | "done" | "blocked";
}

export interface TaskTrackerDocument {
  preludeText: string;
  tasks: Task[];
}

export interface TaskTracker {
  loadDocument(): TaskTrackerDocument;
  pickNextTask(tasks: Task[]): Task | null;
  markDone(tasks: Task[], taskId: string, commitSha: string): Task[];
  markBlocked(tasks: Task[], taskId: string, reason: string, commitSha?: string): Task[];
  saveDocument(doc: TaskTrackerDocument): void;
}

export interface RunContext {
  runId: string;
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

export type RawAgentResult = unknown;

export interface AgentOutput {
  taskId: string;
  status: "success" | "blocked" | "failed";
  commitMessage: string;
  aiThoughts: string;
}

export interface ResultReader {
  read(path: string): RawAgentResult;
}

export interface ResultValidator {
  validate(raw: RawAgentResult, contract: OutputContract): AgentOutput;
}

export interface CommitMessageFormatter {
  formatTitle(task: Task, output: AgentOutput): string;
  formatBody(task: Task, output: AgentOutput): string;
}

export interface GitOps {
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
  taskTracker: TaskTracker;
  promptStrategy: PromptStrategy;
  runContextFactory: RunContextFactory;
  contract: OutputContract;
  agent: CodeAgent;
  resultReader: ResultReader;
  resultValidator: ResultValidator;
  commitFormatter: CommitMessageFormatter;
  git: GitOps;
}

export interface OrchestratorFactory {
  create(deps: OrchestratorDeps): Orchestrator;
}

export interface CLIOptions {
  all?: boolean;
  agent?: string;
  help?: boolean;
}

export interface CLI {
  run(options: CLIOptions): Promise<void>;
}
