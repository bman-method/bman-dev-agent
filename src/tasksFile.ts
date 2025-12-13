import { execFileSync } from "node:child_process";
import path from "node:path";

function runGit(args: string[], cwd: string): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

export function getCurrentBranchName(cwd: string = process.cwd()): string {
  const envBranch = process.env.BMAN_BRANCH?.trim();
  if (envBranch) {
    return envBranch;
  }

  try {
    const branch = runGit(["rev-parse", "--abbrev-ref", "HEAD"], cwd).trim();
    if (branch && branch !== "HEAD") {
      return branch;
    }

    const sha = runGit(["rev-parse", "--short", "HEAD"], cwd).trim();
    return sha ? `detached-${sha}` : "detached-head";
  } catch (err) {
    throw new Error(
      "Unable to determine git branch for default tasks file. Set tasksFile in .bman/config.json or set BMAN_BRANCH."
    );
  }
}

export function getDefaultTasksFilePath(baseDir: string = path.join(process.cwd(), ".bman")): string {
  const resolvedBaseDir = path.isAbsolute(baseDir) ? baseDir : path.resolve(baseDir);
  const branch = getCurrentBranchName(resolvedBaseDir);
  return path.join(resolvedBaseDir, "tracker", branch, "tasks.md");
}
