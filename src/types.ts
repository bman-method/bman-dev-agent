export interface Config {
  agent: string;
  tasksFile: string;
  designFile?: string;
  outputDir: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: "open" | "done" | "blocked";
}

export interface TaskTracker {
  loadTasks(): Task[];
  pickNextTask(tasks: Task[]): Task | null;
  markDone(tasks: Task[], taskId: string, commitSha: string): Task[];
  markBlocked(tasks: Task[], taskId: string, reason: string, commitSha?: string): Task[];
  saveTasks(tasks: Task[]): void;
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
