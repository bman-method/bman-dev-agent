/* =========
 * CONFIG
 * ========= */

interface Config {
  agent: string;                 // "codex" | "claude" | "gemini"
  tasksFile: string;             // default: "tasks.md"
  designFile?: string;
  outputDir: string;             // e.g. ".hamdan/out"
}

interface ConfigLoader {
  load(): Config;
  validate(config: Config): void;
}


/* =========
 * TASK TRACKER
 * ========= */

interface Task {
  id: string;
  title: string;
  description: string;
  status: "open" | "done" | "blocked";
}

interface TaskTracker {
  loadTasks(): Task[];
  pickNextTask(tasks: Task[]): Task | null;
  markDone(tasks: Task[], taskId: string, commitSha: string): Task[];
  markBlocked(tasks: Task[], taskId: string, reason: string, commitSha?: string): Task[];
  saveTasks(tasks: Task[]): void;
}


/* =========
 * RUN CONTEXT
 * ========= */

interface RunContext {
  runId: string;
  taskId: string;
  attempt: number;
  outputPath: string;
}

interface RunContextFactory {
  create(task: Task, attempt: number, config: Config): RunContext;
}


/* =========
 * OUTPUT CONTRACT
 * ========= */

interface OutputContract {
  fields: OutputContractField[];
}

interface OutputContractField {
  name: string;
  descriptionOfContent: string;
  maxLines?: number;
}


/* =========
 * PROMPT
 * ========= */

interface PromptInput {
  task: Task;
  config: Config;
  runContext: RunContext;
  contract: OutputContract;
}

interface PromptStrategy {
  build(input: PromptInput): string;
}


/* =========
 * CODE AGENT
 * ========= */

interface CodeAgent {
  name: string;
  promptStrategy: PromptStrategy;

  run(prompt: string, ctx: RunContext): Promise<void>;
  // MUST write output JSON to ctx.outputPath
}


/* =========
 * OUTPUT TYPES
 * ========= */

type RawAgentResult = unknown;

interface AgentOutput {
  taskId: string;
  status: "success" | "blocked" | "failed";
  commitMessage: string;
  aiThoughts: string;
}


/* =========
 * RESULT READER / VALIDATOR
 * ========= */

interface ResultReader {
  read(path: string): RawAgentResult;
}

interface ResultValidator {
  validate(raw: RawAgentResult, contract: OutputContract): AgentOutput;
}


/* =========
 * COMMIT MESSAGE FORMATTER
 * ========= */

interface CommitMessageFormatter {
  formatTitle(task: Task, output: AgentOutput): string;
  formatBody(task: Task, output: AgentOutput): string;
}


/* =========
 * GIT OPS
 * ========= */

interface GitOps {
  ensureCleanWorkingTree(): void;
  commit(title: string, body: string): string;  // returns sha
  push(): void;
}


/* =========
 * ORCHESTRATOR
 * ========= */

interface Orchestrator {
  runOnce(): Promise<void>;
  runAll(): Promise<void>;
}

interface OrchestratorDeps {
  configLoader: ConfigLoader;
  taskTracker: TaskTracker;
  runContextFactory: RunContextFactory;
  contract: OutputContract;
  agent: CodeAgent;
  resultReader: ResultReader;
  resultValidator: ResultValidator;
  commitFormatter: CommitMessageFormatter;
  git: GitOps;
}

interface OrchestratorFactory {
  create(deps: OrchestratorDeps): Orchestrator;
}


/* =========
 * CLI
 * ========= */

interface CLIOptions {
  all?: boolean;
  agent?: string;
}

interface CLI {
  run(options: CLIOptions): Promise<void>;
}
