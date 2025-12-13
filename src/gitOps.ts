import { execFileSync } from "node:child_process";
import { GitOps } from "./types";

export class DefaultGitOps implements GitOps {
  constructor(private readonly cwd: string = process.cwd()) {}

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
    // Intentional no-op implementation for now; push is optional in v0.
  }

  private runGit(args: string[]): string {
    return execFileSync("git", args, {
      cwd: this.cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  }
}
