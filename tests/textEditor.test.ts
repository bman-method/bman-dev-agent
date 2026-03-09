import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";
import { openTextEditor, textEditorInternals } from "../src/textEditor";

function withTempDir(fn: (dir: string) => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "text-editor-"));
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

class MockStdin extends EventEmitter {
  isTTY = true;
  setRawMode = jest.fn();
  setEncoding = jest.fn();
  resume = jest.fn();
  pause = jest.fn();
}

class MockStdout extends EventEmitter {
  isTTY = true;
  columns = 80;
  rows = 24;
  writes: string[] = [];
  write = jest.fn((chunk: string) => {
    this.writes.push(String(chunk));
    return true;
  });
}

describe("textEditorInternals", () => {
  it("expands tabs and keeps visual columns aligned", () => {
    const { expandTabs, visualColumnForIndex } = textEditorInternals;

    expect(expandTabs("a\tb")).toBe(`a${" ".repeat(7)}b`);
    expect(visualColumnForIndex("\tX", 1)).toBe(8);
    expect(visualColumnForIndex("\tX", 2)).toBe(9);
  });

  it("wraps visual rows based on rendered width", () => {
    const { visualRowsForLine } = textEditorInternals;
    expect(visualRowsForLine("123456", 5)).toBe(2);
  });

  it("filters completions case-insensitively with relative paths", () => {
    withTempDir((dir) => {
      const subdir = path.join(dir, "docs");
      fs.mkdirSync(subdir);
      const targetPath = path.join(subdir, "Target.md");
      fs.writeFileSync(targetPath, "ok");

      const { buildPathIndex, filterCompletionMatches } = textEditorInternals;
      const index = buildPathIndex(dir, fs, path);
      const matches = filterCompletionMatches(index, "tArGeT");

      const expectedValue = path.join("docs", "Target.md");
      expect(matches.some((entry) => entry.value === expectedValue)).toBe(true);
      expect(index.some((entry) => entry.display === `docs${path.sep}`)).toBe(true);
    });
  });

  it("limits completion list by available height with a minimum of 5", () => {
    const { computeCompletionLimit } = textEditorInternals;

    expect(computeCompletionLimit(2, 5, 20)).toBe(5);
    expect(computeCompletionLimit(20, 10, 15)).toBe(1);
  });
});

describe("openTextEditor", () => {
  it("inserts the selected completion relative to cwd", async () => {
    await new Promise<void>((resolve) => {
      withTempDir((dir) => {
        const subdir = path.join(dir, "docs");
        fs.mkdirSync(subdir);
        fs.writeFileSync(path.join(subdir, "Target.md"), "ok");

        const stdin = new MockStdin();
        const stdout = new MockStdout();

        const editorPromise = openTextEditor({
          deps: { stdin, stdout, cwd: () => dir },
        });

        stdin.emit("data", "@targ\t\x04");
        editorPromise.then((value) => {
          expect(value).toBe(path.join("docs", "Target.md"));
          resolve();
        });
      });
    });
  });

  it("renders autocomplete after the line content on first character", async () => {
    await new Promise<void>((resolve) => {
      withTempDir((dir) => {
        fs.writeFileSync(path.join(dir, "foo.txt"), "ok");

        const stdin = new MockStdin();
        const stdout = new MockStdout();

        const editorPromise = openTextEditor({
          deps: { stdin, stdout, cwd: () => dir },
        });

        stdin.emit("data", "@f");
        const lastWrite = stdout.writes[stdout.writes.length - 1] ?? "";
        const lineIndex = lastWrite.indexOf("@f");
        const autocompleteIndex = lastWrite.indexOf("Autocomplete");
        expect(lineIndex).toBeGreaterThanOrEqual(0);
        expect(autocompleteIndex).toBeGreaterThan(lineIndex);

        stdin.emit("data", "\x03");
        editorPromise.then((value) => {
          expect(value).toBeNull();
          resolve();
        });
      });
    });
  });
});
