import path from "node:path";

/**
 * Convert a git branch name into a filesystem-safe directory segment.
 * We percent-encode unsafe characters (including path separators) so that every
 * possible branch name maps to a single directory under the tracker root.
 */
export function getTrackerFolderName(branchName: string): string {
  const resolvedBranchName = branchName.trim();
  if (!resolvedBranchName) {
    throw new Error("Branch name is required to resolve tracker folder name.");
  }

  // encodeURIComponent leaves "*" unescaped; escape it to stay Windows-safe.
  return encodeURIComponent(resolvedBranchName).replace(/\*/g, "%2A");
}

export function getDefaultTasksFilePath(
  branchName: string,
  baseDir: string = path.join(process.cwd(), ".bman")
): string {
  const resolvedBaseDir = path.isAbsolute(baseDir) ? baseDir : path.resolve(baseDir);
  const trackerFolder = getTrackerFolderName(branchName);
  return path.join(resolvedBaseDir, "tracker", trackerFolder, "tasks.md");
}
