import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { DefaultGitOps } from "../src/gitOps";

function withTempRepo(fn: (dir: string) => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gitops-"));
  try {
    runGit(dir, ["init", "-b", "main"]);
    runGit(dir, ["config", "user.email", "dev@example.com"]);
    runGit(dir, ["config", "user.name", "Dev"]);
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function runGit(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

describe("DefaultGitOps", () => {
  it("ensures working tree is clean", () => {
    withTempRepo((dir) => {
      const git = new DefaultGitOps(dir);

      // Clean tree passes
      git.ensureCleanWorkingTree();

      // Dirty tree throws
      fs.writeFileSync(path.join(dir, "file.txt"), "changes");
      expect(() => git.ensureCleanWorkingTree()).toThrow(/Working tree is not clean/);
    });
  });

  it("stages all changes and commits, returning the sha", () => {
    withTempRepo((dir) => {
      fs.writeFileSync(path.join(dir, "file.txt"), "content");

      const git = new DefaultGitOps(dir);
      const sha = git.commit("Add file", "Message body");

      const head = runGit(dir, ["rev-parse", "HEAD"]).trim();
      expect(sha).toBe(head);

      const log = runGit(dir, ["log", "-1", "--pretty=%B"]);
      expect(log.trim()).toBe("Add file\n\nMessage body");
    });
  });

  it("push is a no-op", () => {
    withTempRepo((dir) => {
      const git = new DefaultGitOps(dir);
      git.push(); // should not throw
    });
  });
});
