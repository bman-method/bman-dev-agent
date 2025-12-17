import { DefaultOrchestrator, OrchestratorError } from "../src/orchestrator";
import { AgentOutput, Config, OrchestratorDeps, Task, TaskTrackerDocument } from "../src/types";

function makeTrackerDocument(): TaskTrackerDocument {
  return {
    preludeText: "Intro text",
    tasks: [
      { id: "TASK-11", title: "Config Loader", description: "Do it", status: "open" },
      { id: "TASK-1", title: "Done task", description: "", status: "done" },
    ],
  };
}

function makeDeps(overrides: Partial<OrchestratorDeps> = {}): OrchestratorDeps {
  const trackerDocument = makeTrackerDocument();
  const config: Config = { agent: "codex", tasksFile: "tasks.md", outputDir: ".out" };
  const branchName = overrides.branchName ?? "main";

  const deps: OrchestratorDeps = {
    branchName,
    configLoader: {
      load: jest.fn(() => config),
      validate: jest.fn(),
    },
    taskTracker: {
      loadDocument: jest.fn(() => trackerDocument),
      pickNextTask: jest.fn((tasks: Task[]) => tasks.find((t) => t.status === "open") ?? null),
      markDone: jest.fn((tasks: Task[], taskId: string) =>
        tasks.map((t) => (t.id === taskId ? { ...t, status: "done" } : t))
      ),
      markBlocked: jest.fn((tasks: Task[], taskId: string) =>
        tasks.map((t) => (t.id === taskId ? { ...t, status: "blocked" } : t))
      ),
      saveDocument: jest.fn(),
    },
    promptStrategy: {
      build: jest.fn(() => "PROMPT"),
    },
    runContextFactory: {
      create: jest.fn(() => ({
        runId: "run-1",
        timestamp: "20240101000000000",
        taskId: "TASK-11",
        attempt: 1,
        outputPath: "/tmp/out.json",
      })),
    },
    contract: { fields: [{ name: "taskId", descriptionOfContent: "" }] },
    agent: {
      name: "codex",
      run: jest.fn().mockResolvedValue(undefined),
    },
    resultParser: {
      readAndValidate: jest.fn(
        () =>
          ({
            taskId: "TASK-11",
            status: "success",
            commitMessage: "message",
            changesMade: "thoughts",
            assumptions: "None",
            decisionsTaken: "N/A",
            pointsOfUnclarity: "None",
            testsRun: "Not run",
          } as AgentOutput)
      ),
    },
    commitFormatter: {
      formatTitle: jest.fn(() => "title"),
      formatBody: jest.fn(() => "body"),
    },
    git: {
      getCurrentBranchName: jest.fn(() => branchName),
      ensureCleanWorkingTree: jest.fn(),
      commit: jest.fn(() => "sha123"),
      push: jest.fn(),
    },
    ...overrides,
  };

  return deps;
}

describe("DefaultOrchestrator", () => {
  it("returns immediately when no open task", async () => {
    const deps = makeDeps({
      taskTracker: {
        loadDocument: jest.fn(() => makeTrackerDocument()),
        pickNextTask: jest.fn(() => null),
        markDone: jest.fn(),
        markBlocked: jest.fn(),
        saveDocument: jest.fn(),
      },
    });

    const orchestrator = new DefaultOrchestrator(deps);
    await orchestrator.runOnce();

    expect(deps.agent.run).not.toHaveBeenCalled();
    expect(deps.git.ensureCleanWorkingTree).not.toHaveBeenCalled();
  });

  it("runs happy path: builds prompt, runs agent, commits, marks done, and saves document", async () => {
    const deps = makeDeps();
    const orchestrator = new DefaultOrchestrator(deps);

    await orchestrator.runOnce();

    expect(deps.configLoader.load).toHaveBeenCalledWith("main");
    expect(deps.configLoader.validate).toHaveBeenCalled();
    expect(deps.taskTracker.loadDocument).toHaveBeenCalled();
    expect(deps.git.ensureCleanWorkingTree).toHaveBeenCalled();

    expect(deps.promptStrategy.build).toHaveBeenCalledWith(
      expect.objectContaining({
        task: expect.objectContaining({ id: "TASK-11" }),
        trackerDocument: expect.any(Object),
      })
    );

    expect(deps.agent.run).toHaveBeenCalledWith("PROMPT", expect.objectContaining({ taskId: "TASK-11" }));
    expect(deps.resultParser.readAndValidate).toHaveBeenCalledWith("/tmp/out.json");
    expect(deps.git.commit).toHaveBeenCalledWith("title", "body");
    expect(deps.git.push).toHaveBeenCalled();

    expect(deps.taskTracker.markDone).toHaveBeenCalledWith(
      expect.any(Array),
      "TASK-11"
    );
    expect(deps.taskTracker.saveDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        preludeText: "Intro text",
        tasks: expect.arrayContaining([expect.objectContaining({ id: "TASK-11", status: "done" })]),
      })
    );
    const saveDocumentMock = deps.taskTracker.saveDocument as jest.Mock;
    const commitMock = deps.git.commit as jest.Mock;
    expect(saveDocumentMock.mock.invocationCallOrder[0]).toBeLessThan(commitMock.mock.invocationCallOrder[0]);
    expect(deps.taskTracker.markBlocked).not.toHaveBeenCalled();
  });

  it("marks blocked, saves, and throws when agent output is blocked", async () => {
    const deps = makeDeps({
      resultParser: {
        readAndValidate: jest.fn(
          () =>
            ({
              taskId: "TASK-11",
              status: "blocked",
              commitMessage: "Waiting on dependency",
              changesMade: "None",
              assumptions: "None",
              decisionsTaken: "None",
              pointsOfUnclarity: "Waiting on access",
              testsRun: "Not run",
            } as AgentOutput)
        ),
      },
    });
    const orchestrator = new DefaultOrchestrator(deps);

    await expect(orchestrator.runOnce()).rejects.toThrow(OrchestratorError);

    expect(deps.git.commit).toHaveBeenCalled();
    expect(deps.taskTracker.markBlocked).toHaveBeenCalledWith(
      expect.any(Array),
      "TASK-11"
    );
    expect(deps.taskTracker.saveDocument).toHaveBeenCalled();
  });

  it("best-effort marks blocked when validation fails", async () => {
    const deps = makeDeps({
      resultParser: {
        readAndValidate: jest.fn(() => {
          throw new Error("bad output");
        }),
      },
    });
    const orchestrator = new DefaultOrchestrator(deps);

    await expect(orchestrator.runOnce()).rejects.toThrow("bad output");

    expect(deps.taskTracker.markBlocked).toHaveBeenCalledWith(
      expect.any(Array),
      "TASK-11"
    );
    expect(deps.taskTracker.saveDocument).toHaveBeenCalled();
    expect(deps.git.commit).not.toHaveBeenCalled();
  });
});
