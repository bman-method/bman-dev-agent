import { DefaultCLI, parseArgs } from "../src/cli";
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
  it("returns empty options when no flags provided", () => {
    expect(parseArgs(["node", "cli.js"])).toEqual({});
  });

  it("parses --all, --agent, and --help flags", () => {
    expect(parseArgs(["node", "cli.js", "--all", "--agent", "codex"])).toEqual({
      all: true,
      agent: "codex",
    });

    expect(parseArgs(["node", "cli.js", "-a", "--agent=codex"])).toEqual({
      all: true,
      agent: "codex",
    });

    expect(parseArgs(["node", "cli.js", "--help"])).toEqual({ help: true });
    expect(parseArgs(["node", "cli.js", "--push"])).toEqual({ push: true });
  });

  it("throws on unknown arguments or missing agent value", () => {
    expect(() => parseArgs(["node", "cli.js", "--unknown"])).toThrow(/Unknown argument/);
    expect(() => parseArgs(["node", "cli.js", "--agent"])).toThrow(/Missing value/);
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

    await cli.run({});

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

    await cli.run({ all: true });

    expect(runAll).toHaveBeenCalled();
    expect(runOnce).not.toHaveBeenCalled();
  });

  it("rejects unsupported agents", async () => {
    const cli = new DefaultCLI({
      orchestrator: { runOnce: jest.fn(), runAll: jest.fn() },
    });

    await expect(cli.run({ agent: "other" })).rejects.toThrow(/Unsupported agent/);
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

    await cli.run({});

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
      await cli.run({});

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
      await cli.run({ push: true });
    } finally {
      branchSpy.mockRestore();
    }

    expect(runOnce).toHaveBeenCalled();
    expect((gitInstance as any).pushEnabled).toBe(true);
  });
});
