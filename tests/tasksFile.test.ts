import path from "node:path";
import os from "node:os";
import { getDefaultTasksFilePath, getTrackerFolderName } from "../src/tasksFile";

describe("getTrackerFolderName", () => {
  it("returns simple branch names unchanged", () => {
    expect(getTrackerFolderName("main")).toBe("main");
  });

  it("encodes path separators and whitespace", () => {
    const folder = getTrackerFolderName("ai/brrr feature");
    expect(folder).toBe("ai%2Fbrrr%20feature");
    expect(folder).not.toMatch(/[\\/]/);
  });

  it("encodes characters that are invalid on Windows filesystems", () => {
    const folder = getTrackerFolderName("fix*issue");
    expect(folder).toBe("fix%2Aissue");
    expect(folder).not.toMatch(/\*/);
  });

  it("is deterministic for repeated calls", () => {
    const branch = "feat/weird name*";
    expect(getTrackerFolderName(branch)).toBe(getTrackerFolderName(branch));
  });
});

describe("getDefaultTasksFilePath", () => {
  it("uses the encoded tracker folder name under the base directory", () => {
    const baseDir = path.join(os.tmpdir(), "bman");
    const branch = "ai/brrr";
    const folder = getTrackerFolderName(branch);

    const tasksPath = getDefaultTasksFilePath(branch, baseDir);

    expect(tasksPath).toBe(path.join(baseDir, "tracker", folder, "tasks.md"));
  });
});
