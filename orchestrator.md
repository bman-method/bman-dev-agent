class DefaultOrchestrator implements Orchestrator {
  constructor(private readonly deps: OrchestratorDeps) {}

  async runOnce(): Promise<void> {
    const {
      configLoader,
      taskTracker,
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

    const tasks = taskTracker.loadTasks();
    const task = taskTracker.pickNextTask(tasks);

    if (!task) return; // nothing to do

    // v0 assumption: we start from a clean working tree to keep diffs/commits sane.
    git.ensureCleanWorkingTree();

    const attempt = 1;
    const ctx = runContextFactory.create(task, attempt, config);

    const prompt = agent.promptStrategy.build({
      task,
      config,
      runContext: ctx,
      contract,
    });

    let output: AgentOutput | null = null;
    let commitSha: string | undefined;

    try {
      // Run the code tool (must write JSON to ctx.outputPath)
      await agent.run(prompt, ctx);

      // Read + validate output.json
      const raw: RawAgentResult = resultReader.read(ctx.outputPath);
      output = resultValidator.validate(raw, contract);

      // Optional: enforce that taskId matches (light sanity check)
      if (output.taskId !== task.id) {
        throw new OrchestratorError(
          `AgentOutput.taskId (${output.taskId}) does not match current task (${task.id}).`
        );
      }

      // Commit (even on blocked/failed: keeps trace; stop later if not success)
      const title = commitFormatter.formatTitle(task, output);
      const body = commitFormatter.formatBody(task, output);

      commitSha = git.commit(title, body);

      // Push is always attempted here; implement GitOps.push() as no-op if desired.
      git.push();

      // Update tasks based on status
      let newTasks: Task[];
      if (output.status === "success") {
        newTasks = taskTracker.markDone(tasks, task.id, commitSha);
      } else {
        // Use commitMessage as the “reason” text for blocked/failed
        const reason = (output.commitMessage || "").trim() || `Task ended with status: ${output.status}`;
        newTasks = taskTracker.markBlocked(tasks, task.id, reason, commitSha);
      }

      taskTracker.saveTasks(newTasks);

      // Stop the run on non-success, after committing and marking.
      if (output.status !== "success") {
        throw new OrchestratorError(
          `Task ${task.id} ended with status "${output.status}". Stopping.`
        );
      }
    } catch (err) {
      // Best-effort: mark task blocked if we can’t even read/validate output.
      // We try not to lose the info that something went wrong.
      const reason = err instanceof Error ? err.message : String(err);

      try {
        const updated = taskTracker.markBlocked(tasks, task.id, reason, commitSha);
        taskTracker.saveTasks(updated);
      } catch {
        // If task file update fails, don’t mask the original error.
      }

      // Re-throw for CLI to return non-zero exit, etc.
      throw err;
    }
  }

  async runAll(): Promise<void> {
    // Keep iterating until no more open tasks or until runOnce throws.
    while (true) {
      const { taskTracker, configLoader } = this.deps;

      const config = configLoader.load();
      configLoader.validate(config);

      const tasks = taskTracker.loadTasks();
      const next = taskTracker.pickNextTask(tasks);
      if (!next) return;

      await this.runOnce(); // will throw on blocked/failed
    }
  }
}

