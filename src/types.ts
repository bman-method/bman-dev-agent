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
