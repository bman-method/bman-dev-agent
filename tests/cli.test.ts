import { DefaultCLI, parseArgs } from "../src/cli";

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
    const cli = new DefaultCLI({
      orchestrator: { runOnce, runAll },
    });

    await cli.run({});

    expect(runOnce).toHaveBeenCalled();
    expect(runAll).not.toHaveBeenCalled();
  });

  it("runs runAll when --all is provided", async () => {
    const runOnce = jest.fn();
    const runAll = jest.fn().mockResolvedValue(undefined);
    const cli = new DefaultCLI({
      orchestrator: { runOnce, runAll },
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
    const configLoader = {
      load: jest.fn(() => ({ agent: "codex", tasksFile: "tasks.md", outputDir: ".out" })),
      validate: jest.fn(),
    };
    const taskTracker = {
      loadDocument: jest.fn(() => ({
        preludeText: "",
        tasks: [{ id: "T1", title: "t", description: "", status: "done" as const }],
      })),
      pickNextTask: jest.fn(() => null),
      markDone: jest.fn(),
      markBlocked: jest.fn(),
      saveDocument: jest.fn(),
    };
    const orchestratorFactory = { create: jest.fn() };
    const cli = new DefaultCLI({ configLoader, taskTracker, orchestratorFactory });
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});

    await cli.run({});

    expect(spy).toHaveBeenCalledWith("No open tasks found. Nothing to run.");
    expect(orchestratorFactory.create).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
