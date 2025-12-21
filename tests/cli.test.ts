import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DefaultCLI, UsageError, main, parseArgs } from "../src/cli";
import { DefaultConfigLoader } from "../src/configLoader";
import { DefaultGitOps } from "../src/gitOps";
import { parseDocument } from "../src/taskTracker";
import { Task } from "../src/types";
import { getTrackerFolderName } from "../src/tasksFile";

const baseConfig = {
  agent: {
    default: "codex",
    registry: {
      codex: {
        cmd: ["codex", "exec", "--sandbox", "workspace-write", "--skip-git-repo-check", "-"],
      },
      gemini: {
        cmd: ["gemini", "--approval-mode", "auto_edit"],
      },
      claude: {
        cmd: ["claude", "--allowedTools", "Read,Write,Bash", "--output-format", "json", "-p", "--verbose"],
      },
    },
  },
  tasksFile: "tasks.md",
  outputDir: ".out",
};

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
    addTask: jest.fn(),
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

  it("rejects resolve-specific flags when using add-task", () => {
    expect(() => parseArgs(["node", "cli.js", "add-task", "--all", "Write docs"])).toThrow(
      /resolve/
    );
    expect(() => parseArgs(["node", "cli.js", "add-task", "--push", "Write docs"])).toThrow(
      /resolve/
    );
    expect(() =>
      parseArgs(["node", "cli.js", "add-task", "--agent", "codex", "Write docs"])
    ).toThrow(/resolve/);
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
    const configLoader = makeConfigLoader();
    const taskTracker = makeTaskTracker([
      { id: "T1", title: "Task", description: "", status: "open" },
    ]);
    const git = makeGit();
    const cli = new DefaultCLI({
      orchestrator: { runOnce: jest.fn(), runAll: jest.fn() },
      configLoader,
      taskTracker,
      git,
    });

    await expect(cli.run({ command: "resolve", agent: "other" })).rejects.toThrow(/Unsupported/);
  });

  it("rejects agent names missing from the registry", async () => {
    const configLoader = makeConfigLoader();
    configLoader.load.mockReturnValue({
      ...baseConfig,
      agent: {
        default: "codex",
        registry: {
          codex: {
            cmd: ["codex"],
          },
        },
      },
    });
    const taskTracker = makeTaskTracker([
      { id: "T1", title: "Task", description: "", status: "open" },
    ]);
    const git = makeGit();
    const cli = new DefaultCLI({
      orchestrator: { runOnce: jest.fn(), runAll: jest.fn() },
      configLoader,
      taskTracker,
      git,
    });

    await expect(cli.run({ command: "resolve", agent: "custom" })).rejects.toThrow(/Unsupported/);
  });

  it("uses a custom registry agent when configured as default", async () => {
    const runOnce = jest.fn().mockResolvedValue(undefined);
    const runAll = jest.fn();
    const configLoader = makeConfigLoader();
    configLoader.load.mockReturnValue({
      ...baseConfig,
      agent: {
        default: "gemini-lite",
        registry: {
          ...baseConfig.agent.registry,
          "gemini-lite": { cmd: ["/bin/echo", "--flag"] },
        },
      },
    });
    const taskTracker = makeTaskTracker([
      { id: "T1", title: "Task", description: "", status: "open" },
    ]);
    const git = makeGit();
    let agentName: string | undefined;
    const orchestratorFactory = {
      create: jest.fn((deps) => {
        agentName = deps.agent.name;
        return { runOnce, runAll };
      }),
    };
    const cli = new DefaultCLI({ configLoader, taskTracker, orchestratorFactory, git });

    await cli.run({ command: "resolve" });

    expect(agentName).toBe("gemini-lite");
    expect(runOnce).toHaveBeenCalled();
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

  it("delegates task creation to the task tracker and logs the result", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-add-task-"));
    const tasksFile = path.join(dir, "tasks.md");
    fs.writeFileSync(tasksFile, "existing content");

    const addedTask: Task = {
      id: "TASK-4",
      title: "New task",
      description: "",
      status: "open",
    };
    const configLoader = makeConfigLoader();
    configLoader.load.mockReturnValue({ ...baseConfig, tasksFile });
    const taskTracker = {
      loadDocument: jest.fn(),
      pickNextTask: jest.fn(),
      markDone: jest.fn(),
      markBlocked: jest.fn(),
      saveDocument: jest.fn(),
      addTask: jest.fn(() => addedTask),
    };
    const git = makeGit();
    const cli = new DefaultCLI({ configLoader, taskTracker, git });
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    try {
      await cli.run({ command: "add-task", taskDescription: "New task" });

      expect(taskTracker.addTask).toHaveBeenCalledWith("New task");
      expect(taskTracker.loadDocument).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Added task TASK-4 to ${path.resolve(tasksFile)}`)
      );
    } finally {
      logSpy.mockRestore();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("still logs when the tasks file is missing", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-add-task-"));
    const tasksFile = path.join(dir, "tasks.md");
    const configLoader = makeConfigLoader();
    configLoader.load.mockReturnValue({ ...baseConfig, tasksFile });
    const addedTask: Task = {
      id: "TASK-1",
      title: "First task",
      description: "",
      status: "open",
    };
    const taskTracker = {
      loadDocument: jest.fn(),
      pickNextTask: jest.fn(),
      markDone: jest.fn(),
      markBlocked: jest.fn(),
      saveDocument: jest.fn(),
      addTask: jest.fn(() => addedTask),
    };
    const git = makeGit();
    const cli = new DefaultCLI({ configLoader, taskTracker, git });
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    try {
      await cli.run({ command: "add-task", taskDescription: "First task" });

      expect(taskTracker.addTask).toHaveBeenCalledWith("First task");
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Added task TASK-1 to ${path.resolve(tasksFile)}`)
      );
    } finally {
      logSpy.mockRestore();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("creates the tracker file under an encoded branch directory", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-add-task-"));
    const branchName = "ai/brrr feature";
    const git = { getCurrentBranchName: jest.fn(() => branchName) } as any;
    const configPath = path.join(dir, ".bman", "config.json");
    const cli = new DefaultCLI({ configLoader: new DefaultConfigLoader(configPath), git });
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    try {
      await cli.run({ command: "add-task", taskDescription: "Weird branch task" });

      const folder = getTrackerFolderName(branchName);
      const tasksFile = path.join(dir, ".bman", "tracker", folder, "tasks.md");
      const saved = fs.readFileSync(tasksFile, "utf8");
      const doc = parseDocument(saved);

      expect(doc.tasks[0]?.title).toBe("Weird branch task");
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(path.resolve(tasksFile)));
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
