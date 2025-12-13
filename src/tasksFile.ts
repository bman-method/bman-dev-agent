import path from "node:path";

export function getDefaultTasksFilePath(
  branchName: string,
  baseDir: string = path.join(process.cwd(), ".bman")
): string {
  const resolvedBranchName = branchName.trim();
  if (!resolvedBranchName) {
    throw new Error("Branch name is required to resolve default tasks file path.");
  }

  const resolvedBaseDir = path.isAbsolute(baseDir) ? baseDir : path.resolve(baseDir);
  return path.join(resolvedBaseDir, "tracker", resolvedBranchName, "tasks.md");
}
