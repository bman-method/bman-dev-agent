import { execFileSync } from "node:child_process";
import { GitOps } from "./types";

export class DefaultGitOps implements GitOps {
  constructor(
    private readonly cwd: string = process.cwd(),
    private readonly pushEnabled: boolean = false
  ) {}

  getCurrentBranchName(): string {
    try {
      const branch = this.runGit(["rev-parse", "--abbrev-ref", "HEAD"]).trim();
      if (branch && branch !== "HEAD") {
        return branch;
      }

      const sha = this.runGit(["rev-parse", "--short", "HEAD"]).trim();
      return sha ? `detached-${sha}` : "detached-head";
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(`Unable to determine current git branch: ${reason}`);
    }
  }

  ensureCleanWorkingTree(): void {
    const output = this.runGit(["status", "--porcelain"]);
    if (output.trim() !== "") {
      throw new Error("Working tree is not clean. Commit or stash changes before proceeding.");
    }
  }

  commit(title: string, body: string): string {
    this.runGit(["add", "-A"]);
    this.runGit(["commit", "-m", title, "-m", body]);
    const sha = this.runGit(["rev-parse", "HEAD"]).trim();
    return sha;
  }

  push(): void {
    if (!this.pushEnabled) {
      return;
    }

    this.runGit(["push"]);
  }

  private runGit(args: string[]): string {
    return execFileSync("git", args, {
      cwd: this.cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  }
}
