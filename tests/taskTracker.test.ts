import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  DefaultTaskTracker,
  parseDocument,
  serializeDocument,
} from "../src/taskTracker";
import { Task } from "../src/types";

function withTempDir(fn: (dir: string) => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tasks-"));
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const sampleFile = `Instructions:
- keep tasks short

- [ ] TASK-1: First task
   Do the first thing.

- [x] TASK-2: Finished task
  Already completed.   

- [!] TASK-3: Blocked task
Waiting on external dependency.
`;

describe("parseDocument", () => {
  it("parses prelude text and tasks with ids, titles, statuses, and descriptions", () => {
    const doc = parseDocument(sampleFile);
    expect(doc.preludeText).toBe("Instructions:\n- keep tasks short\n");
    expect(doc.tasks).toEqual<Task[]>([
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
    const duplicate = `Prelude text\n\n- [ ] T1: First\n- [ ] T1: Second`;
    expect(() => parseDocument(duplicate)).toThrow(/Duplicate task id/);
  });
});

describe("DefaultTaskTracker", () => {
  it("loads tasks from the tasks file and picks the next open task", () => {
    withTempDir((dir) => {
      const filePath = path.join(dir, "tasks.md");
      fs.writeFileSync(filePath, sampleFile);

      const tracker = new DefaultTaskTracker(filePath);
      const doc = tracker.loadDocument();
      const next = tracker.pickNextTask(doc.tasks);

      expect(doc.preludeText).toBe("Instructions:\n- keep tasks short\n");
      expect(next?.id).toBe("TASK-1");
    });
  });

  it("tolerates extra spaces in the checkbox", () => {
    const spaced = `  - [  ] TASK-1: First task`;
    withTempDir((dir) => {
      const filePath = path.join(dir, "tasks.md");
      fs.writeFileSync(filePath, spaced);

      const tracker = new DefaultTaskTracker(filePath);
      const doc = tracker.loadDocument();

      expect(doc.tasks).toEqual<Task[]>([
        { id: "TASK-1", title: "First task", description: "", status: "open" },
      ]);
      expect(doc.preludeText).toBe("");
    });
  });

  it("marks tasks as done or blocked and saves deterministically", () => {
    withTempDir((dir) => {
      const filePath = path.join(dir, "tasks.md");
      fs.writeFileSync(filePath, sampleFile);

      const tracker = new DefaultTaskTracker(filePath);
      const doc = tracker.loadDocument();

      const markedDone = tracker.markDone(doc.tasks, "TASK-1");
      const markedBlocked = tracker.markBlocked(markedDone, "TASK-3");
      tracker.saveDocument({ ...doc, tasks: markedBlocked });

      const saved = fs.readFileSync(filePath, "utf8");
      const expected = serializeDocument({
        preludeText: doc.preludeText,
        tasks: [
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
        ],
      });

      expect(saved).toBe(expected);
    });
  });

  it("throws when marking an unknown task id", () => {
    const tracker = new DefaultTaskTracker("noop");
    const tasks: Task[] = [
      { id: "T1", title: "Title", description: "Desc", status: "open" },
    ];
    expect(() => tracker.markDone(tasks, "missing")).toThrow(/not found/);
  });

  it("adds a new task with the next sequential TASK id", () => {
    withTempDir((dir) => {
      const filePath = path.join(dir, "tasks.md");
      const existingTasks: Task[] = [
        { id: "TASK-1", title: "First", description: "", status: "open" },
        { id: "OTHER", title: "Other", description: "", status: "done" },
        { id: "TASK-3", title: "Third", description: "", status: "open" },
      ];
      fs.writeFileSync(
        filePath,
        serializeDocument({ preludeText: "Prelude", tasks: existingTasks })
      );

      const tracker = new DefaultTaskTracker(filePath);
      const addedTask = tracker.addTask("New task");

      expect(addedTask).toEqual({
        id: "TASK-4",
        title: "New task",
        description: "",
        status: "open",
      });
      const saved = parseDocument(fs.readFileSync(filePath, "utf8"));
      expect(saved).toEqual({
        preludeText: "Prelude\n",
        tasks: [...existingTasks, addedTask],
      });
    });
  });

  it("initializes a new document when adding the first task", () => {
    withTempDir((dir) => {
      const filePath = path.join(dir, "tasks.md");
      const tracker = new DefaultTaskTracker(filePath);

      const addedTask = tracker.addTask("First task");

      expect(addedTask.id).toBe("TASK-1");
      const saved = parseDocument(fs.readFileSync(filePath, "utf8"));
      expect(saved).toEqual({
        preludeText: "",
        tasks: [
          { id: "TASK-1", title: "First task", description: "", status: "open" },
        ],
      });
    });
  });
});
