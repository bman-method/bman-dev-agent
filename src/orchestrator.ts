import {
  AgentOutput,
  Orchestrator,
  OrchestratorDeps,
  OrchestratorFactory,
  PromptInput,
  Task,
  TaskTrackerDocument,
} from "./types";
import { deriveHumanMessage } from "./commitMessageFormatter";

export class OrchestratorError extends Error {}

export class DefaultOrchestrator implements Orchestrator {
  constructor(private readonly deps: OrchestratorDeps) {}

  async runOnce(): Promise<void> {
    const {
      configLoader,
      taskTracker,
      promptStrategy,
      runContextFactory,
      contract,
      agent,
      resultReader,
      resultValidator,
      commitFormatter,
      git,
    } = this.deps;

    const config = configLoader.load();
    configLoader.validate(config);

    const trackerDocument = taskTracker.loadDocument();
    const task = taskTracker.pickNextTask(trackerDocument.tasks);
    if (!task) {
      console.log("Orchestrator: no open tasks. Nothing to run.");
      return;
    }

    console.log(`Orchestrator: running task ${task.id} - ${task.title}`);

    git.ensureCleanWorkingTree();

    const attempt = 1;
    const ctx = runContextFactory.create(task, attempt, config);

    const promptInput: PromptInput = {
      task,
      config,
      runContext: ctx,
      contract,
      trackerDocument,
    };
    const prompt = promptStrategy.build(promptInput);

    let output: AgentOutput | null = null;
    let commitSha: string | undefined;
    let tasksUpdated = false;

    try {
      await agent.run(prompt, ctx);

      const raw = resultReader.read(ctx.outputPath);
      output = resultValidator.validate(raw, contract);

      if (output.taskId !== task.id) {
        throw new OrchestratorError(
          `AgentOutput.taskId (${output.taskId}) does not match current task (${task.id}).`
        );
      }

      const updatedTasks = this.updateTasks(taskTracker, trackerDocument, task, output, commitSha);
      taskTracker.saveDocument({ ...trackerDocument, tasks: updatedTasks });
      tasksUpdated = true;

      const title = commitFormatter.formatTitle(task, output);
      const body = commitFormatter.formatBody(task, output);

      commitSha = git.commit(title, body);
      git.push();
      console.log(`Orchestrator: created commit ${commitSha}`);

      console.log(`Orchestrator: task ${task.id} completed with status "${output.status}"`);

      if (output.status !== "success") {
        throw new OrchestratorError(
          `Task ${task.id} ended with status "${output.status}". Stopping.`
        );
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error(`Orchestrator: task ${task.id} failed - ${reason}`);

      if (!tasksUpdated || !commitSha) {
        try {
          const updatedTasks = taskTracker.markBlocked(trackerDocument.tasks, task.id, reason, commitSha);
          taskTracker.saveDocument({ ...trackerDocument, tasks: updatedTasks });
        } catch {
          // If task update fails, surface the original error.
        }
      }

      throw err;
    }
  }

  async runAll(): Promise<void> {
    while (true) {
      const { taskTracker } = this.deps;
      const doc = taskTracker.loadDocument();
      const next = taskTracker.pickNextTask(doc.tasks);
      if (!next) return;

      console.log(`Orchestrator: starting task ${next.id} from runAll`);

      await this.runOnce();
    }
  }

  private updateTasks(
    taskTracker: OrchestratorDeps["taskTracker"],
    trackerDocument: TaskTrackerDocument,
    task: Task,
    output: AgentOutput,
    commitSha?: string
  ): Task[] {
    if (output.status === "success") {
      return taskTracker.markDone(trackerDocument.tasks, task.id, commitSha ?? "");
    }

    const reason = deriveHumanMessage(task, output);
    return taskTracker.markBlocked(trackerDocument.tasks, task.id, reason, commitSha);
  }
}

export class DefaultOrchestratorFactory implements OrchestratorFactory {
  create(deps: OrchestratorDeps): Orchestrator {
    return new DefaultOrchestrator(deps);
  }
}
