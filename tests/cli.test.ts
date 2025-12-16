import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DefaultCLI, UsageError, main, parseArgs } from "../src/cli";
import { DefaultGitOps } from "../src/gitOps";
import { Task } from "../src/types";

const baseConfig = { agent: "codex", tasksFile: "tasks.md", outputDir: ".out" };

type MockConfigLoader = { load: jest.Mock; validate: jest.Mock };

function makeConfigLoader(): MockConfigLoader {
  return {
    load: jest.fn((_branch: string) => ({ ...baseConfig })),
    validate: jest.fn(),
  };
}

function makeGit(branch = "main", pushEnabled = false) {
  return {
    pushEnabled,
    getCurrentBranchName: jest.fn(() => branch),
    ensureCleanWorkingTree: jest.fn(),
    commit: jest.fn(),
    push: jest.fn(),
  };
}

function makeTaskTracker(tasks: Task[]) {
  return {
    loadDocument: jest.fn(() => ({ preludeText: "", tasks })),
    pickNextTask: jest.fn((list: Task[]) => list.find((t) => t.status === "open") ?? null),
    markDone: jest.fn(),
    markBlocked: jest.fn(),
    saveDocument: jest.fn(),
  };
}

describe("parseArgs", () => {
  it("requires a command when not requesting help", () => {
    expect(() => parseArgs(["node", "cli.js"])).toThrow(UsageError);
  });

  it("parses resolve command and flags", () => {
    expect(parseArgs(["node", "cli.js", "resolve"])).toEqual({ command: "resolve" });

    expect(parseArgs(["node", "cli.js", "resolve", "--all", "--agent", "codex"])).toEqual({
      all: true,
      agent: "codex",
      command: "resolve",
    });

    expect(parseArgs(["node", "cli.js", "resolve", "-a", "--agent=codex"])).toEqual({
      all: true,
      agent: "codex",
      command: "resolve",
    });

    expect(parseArgs(["node", "cli.js", "--help"])).toEqual({ help: true });
    expect(parseArgs(["node", "cli.js", "resolve", "--push"])).toEqual({
      command: "resolve",
      push: true,
    });
  });

  it("parses add-task command with a description", () => {
    expect(parseArgs(["node", "cli.js", "add-task", "Write docs"])).toEqual({
      command: "add-task",
      taskDescription: "Write docs",
    });
  });

  it("throws on unknown arguments or missing agent value", () => {
    expect(() => parseArgs(["node", "cli.js", "resolve", "--unknown"])).toThrow(/Unknown argument/);
    expect(() => parseArgs(["node", "cli.js", "resolve", "--agent"])).toThrow(/Missing value/);
  });
});

describe("DefaultCLI", () => {
  it("runs runOnce by default", async () => {
    const runOnce = jest.fn().mockResolvedValue(undefined);
    const runAll = jest.fn();
    const configLoader = makeConfigLoader();
    const taskTracker = makeTaskTracker([
      { id: "T1", title: "Task", description: "", status: "open" },
    ]);
    const git = makeGit();
    const cli = new DefaultCLI({
      orchestrator: { runOnce, runAll },
      configLoader,
      taskTracker,
      git,
    });

    await cli.run({ command: "resolve" });

    expect(runOnce).toHaveBeenCalled();
    expect(runAll).not.toHaveBeenCalled();
  });

  it("runs runAll when --all is provided", async () => {
    const runOnce = jest.fn();
    const runAll = jest.fn().mockResolvedValue(undefined);
    const configLoader = makeConfigLoader();
    const taskTracker = makeTaskTracker([
      { id: "T1", title: "Task", description: "", status: "open" },
    ]);
    const git = makeGit();
    const cli = new DefaultCLI({
      orchestrator: { runOnce, runAll },
      configLoader,
      taskTracker,
      git,
    });

    await cli.run({ command: "resolve", all: true });

    expect(runAll).toHaveBeenCalled();
    expect(runOnce).not.toHaveBeenCalled();
  });

  it("rejects unsupported agents", async () => {
    const cli = new DefaultCLI({
      orchestrator: { runOnce: jest.fn(), runAll: jest.fn() },
    });

    await expect(cli.run({ command: "resolve", agent: "other" })).rejects.toThrow(/Unsupported/);
  });

  it("prints usage and exits when help is requested", async () => {
    const runOnce = jest.fn();
    const runAll = jest.fn();
    const cli = new DefaultCLI({
      orchestrator: { runOnce, runAll },
    });

    await cli.run({ help: true });

    expect(runOnce).not.toHaveBeenCalled();
    expect(runAll).not.toHaveBeenCalled();
  });

  it("prints message when no open tasks", async () => {
    const configLoader = makeConfigLoader();
    const taskTracker = makeTaskTracker([
      { id: "T1", title: "t", description: "", status: "done" },
    ]);
    const orchestratorFactory = { create: jest.fn() };
    const git = makeGit();
    const cli = new DefaultCLI({ configLoader, taskTracker, orchestratorFactory, git });
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});

    await cli.run({ command: "resolve" });

    expect(spy).toHaveBeenCalledWith("No open tasks found. Nothing to run.");
    expect(orchestratorFactory.create).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("refuses to run when blocked tasks exist", async () => {
    const runOnce = jest.fn();
    const runAll = jest.fn();
    const configLoader = makeConfigLoader();
    const taskTracker = makeTaskTracker([
      { id: "T1", title: "Blocked task", description: "", status: "blocked" },
      { id: "T2", title: "Open task", description: "", status: "open" },
    ]);
    const git = makeGit();
    const cli = new DefaultCLI({
      orchestrator: { runOnce, runAll },
      configLoader,
      taskTracker,
      git,
    });
    const originalExitCode = process.exitCode;
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});

    try {
      await cli.run({ command: "resolve" });

      expect(runOnce).not.toHaveBeenCalled();
      expect(spy).toHaveBeenCalledWith(
        "Blocked tasks present. Resolve blocked tasks before starting new work."
      );
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = originalExitCode;
      spy.mockRestore();
    }
  });

  it("enables pushing when --push is provided", async () => {
    const runOnce = jest.fn().mockResolvedValue(undefined);
    const runAll = jest.fn();
    const configLoader = makeConfigLoader();
    const taskTracker = makeTaskTracker([
      { id: "T1", title: "Task", description: "", status: "open" },
    ]);
    let gitInstance: unknown;
    const orchestratorFactory = {
      create: jest.fn((deps) => {
        gitInstance = deps.git;
        return { runOnce, runAll };
      }),
    };
    const branchSpy = jest
      .spyOn(DefaultGitOps.prototype, "getCurrentBranchName")
      .mockReturnValue("main");
    const cli = new DefaultCLI({ orchestratorFactory, configLoader, taskTracker });

    try {
      await cli.run({ command: "resolve", push: true });
    } finally {
      branchSpy.mockRestore();
    }

    expect(runOnce).toHaveBeenCalled();
    expect((gitInstance as any).pushEnabled).toBe(true);
  });

  it("appends the next task id and saves the updated document", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-add-task-"));
    const tasksFile = path.join(dir, "tasks.md");
    fs.writeFileSync(tasksFile, "existing content");

    const existingTasks: Task[] = [
      { id: "TASK-1", title: "First", description: "", status: "open" },
      { id: "OTHER", title: "Other", description: "", status: "done" },
      { id: "TASK-3", title: "Third", description: "", status: "open" },
    ];
    const configLoader = makeConfigLoader();
    configLoader.load.mockReturnValue({ ...baseConfig, tasksFile });
    const taskTracker = {
      loadDocument: jest.fn(() => ({ preludeText: "Prelude", tasks: existingTasks })),
      pickNextTask: jest.fn(),
      markDone: jest.fn(),
      markBlocked: jest.fn(),
      saveDocument: jest.fn(),
    };
    const git = makeGit();
    const cli = new DefaultCLI({ configLoader, taskTracker, git });
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    try {
      await cli.run({ command: "add-task", taskDescription: "New task" });

      expect(taskTracker.saveDocument).toHaveBeenCalledWith({
        preludeText: "Prelude",
        tasks: [
          ...existingTasks,
          { id: "TASK-4", title: "New task", description: "", status: "open" },
        ],
      });
      expect(taskTracker.loadDocument).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Added task TASK-4 to ${path.resolve(tasksFile)}`)
      );
    } finally {
      logSpy.mockRestore();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("initializes a new document when the tasks file is missing", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-add-task-"));
    const tasksFile = path.join(dir, "tasks.md");
    const configLoader = makeConfigLoader();
    configLoader.load.mockReturnValue({ ...baseConfig, tasksFile });
    const taskTracker = {
      loadDocument: jest.fn(),
      pickNextTask: jest.fn(),
      markDone: jest.fn(),
      markBlocked: jest.fn(),
      saveDocument: jest.fn(),
    };
    const git = makeGit();
    const cli = new DefaultCLI({ configLoader, taskTracker, git });
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    try {
      await cli.run({ command: "add-task", taskDescription: "First task" });

      expect(taskTracker.loadDocument).not.toHaveBeenCalled();
      expect(taskTracker.saveDocument).toHaveBeenCalledWith({
        preludeText: "",
        tasks: [{ id: "TASK-1", title: "First task", description: "", status: "open" }],
      });
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Added task TASK-1 to ${path.resolve(tasksFile)}`)
      );
    } finally {
      logSpy.mockRestore();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("does not print usage on runtime errors", async () => {
    const argv = process.argv;
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const runSpy = jest
      .spyOn(DefaultCLI.prototype as any, "run")
      .mockImplementationOnce(() => {
        throw new Error("runtime failure");
      });
    process.argv = ["node", "cli.js", "resolve"];
    const originalExitCode = process.exitCode;

    try {
      await main();
      expect(consoleSpy).toHaveBeenCalledWith("runtime failure");
      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining("Usage:"));
    } finally {
      process.argv = argv;
      consoleSpy.mockRestore();
      runSpy.mockRestore();
      process.exitCode = originalExitCode;
    }
  });
});
