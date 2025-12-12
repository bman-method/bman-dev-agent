import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { DefaultTaskTracker, parseTasks, serializeTasks } from "../src/taskTracker";
import { Task } from "../src/types";

function withTempDir(fn: (dir: string) => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tasks-"));
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const sampleFile = `- [ ] TASK-1: First task
   Do the first thing.

- [x] TASK-2: Finished task
  Already completed.   

- [!] TASK-3: Blocked task
Waiting on external dependency.
`;

describe("parseTasks", () => {
  it("parses tasks with ids, titles, statuses, and descriptions", () => {
    const tasks = parseTasks(sampleFile);
    expect(tasks).toEqual<Task[]>([
      {
        id: "TASK-1",
        title: "First task",
        description: "Do the first thing.",
        status: "open",
      },
      {
        id: "TASK-2",
        title: "Finished task",
        description: "Already completed.",
        status: "done",
      },
      {
        id: "TASK-3",
        title: "Blocked task",
        description: "Waiting on external dependency.",
        status: "blocked",
      },
    ]);
  });

  it("throws when encountering duplicate task ids", () => {
    const duplicate = `- [ ] T1: First\n- [ ] T1: Second`;
    expect(() => parseTasks(duplicate)).toThrow(/Duplicate task id/);
  });
});

describe("DefaultTaskTracker", () => {
  it("loads tasks from the tasks file and picks the next open task", () => {
    withTempDir((dir) => {
      const filePath = path.join(dir, "tasks.md");
      fs.writeFileSync(filePath, sampleFile);

      const tracker = new DefaultTaskTracker(filePath);
      const tasks = tracker.loadTasks();
      const next = tracker.pickNextTask(tasks);

      expect(next?.id).toBe("TASK-1");
    });
  });

  it("tolerates extra spaces in the checkbox", () => {
    const spaced = `  - [  ] TASK-1: First task`;
    withTempDir((dir) => {
      const filePath = path.join(dir, "tasks.md");
      fs.writeFileSync(filePath, spaced);

      const tracker = new DefaultTaskTracker(filePath);
      const tasks = tracker.loadTasks();

      expect(tasks).toEqual<Task[]>([
        { id: "TASK-1", title: "First task", description: "", status: "open" },
      ]);
    });
  });

  it("marks tasks as done or blocked and saves deterministically", () => {
    withTempDir((dir) => {
      const filePath = path.join(dir, "tasks.md");
      fs.writeFileSync(filePath, sampleFile);

      const tracker = new DefaultTaskTracker(filePath);
      const tasks = tracker.loadTasks();

      const markedDone = tracker.markDone(tasks, "TASK-1", "sha123");
      const markedBlocked = tracker.markBlocked(markedDone, "TASK-3", "Waiting", "sha456");
      tracker.saveTasks(markedBlocked);

      const saved = fs.readFileSync(filePath, "utf8");
      const expected = serializeTasks([
        {
          id: "TASK-1",
          title: "First task",
          description: "Do the first thing.",
          status: "done",
        },
        {
          id: "TASK-2",
          title: "Finished task",
          description: "Already completed.",
          status: "done",
        },
        {
          id: "TASK-3",
          title: "Blocked task",
          description: "Waiting on external dependency.",
          status: "blocked",
        },
      ]);

      expect(saved).toBe(expected);
    });
  });

  it("throws when marking an unknown task id", () => {
    const tracker = new DefaultTaskTracker("noop");
    const tasks: Task[] = [
      { id: "T1", title: "Title", description: "Desc", status: "open" },
    ];
    expect(() => tracker.markDone(tasks, "missing", "sha")).toThrow(/not found/);
  });
});
