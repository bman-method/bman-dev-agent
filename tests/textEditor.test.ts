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
  it("builds a path index and skips ignored directories", () => {
    withTempDir((dir) => {
      fs.mkdirSync(path.join(dir, ".git"));
      fs.mkdirSync(path.join(dir, "node_modules"));
      fs.mkdirSync(path.join(dir, "src"));
      fs.writeFileSync(path.join(dir, "src", "app.ts"), "ok");

      const { buildPathIndex } = textEditorInternals;
      const index = buildPathIndex(dir, fs, path);
      const values = index.map((entry) => entry.value);

      expect(values).toContain(path.join("src", "app.ts"));
      expect(values).not.toContain(path.join(".git"));
      expect(values).not.toContain(path.join("node_modules"));
    });
  });

  it("expands tabs and keeps visual columns aligned", () => {
    const { expandTabs, visualColumnForIndex } = textEditorInternals;

    expect(expandTabs("a\tb")).toBe(`a${" ".repeat(7)}b`);
    expect(visualColumnForIndex("\tX", 1)).toBe(8);
    expect(visualColumnForIndex("\tX", 2)).toBe(9);
  });

  it("wraps visual rows based on rendered width", () => {
    const { visualRowsForLine } = textEditorInternals;
    expect(visualRowsForLine("123456", 5)).toBe(2);
    expect(visualRowsForLine("", 0)).toBe(1);
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
    expect(computeCompletionLimit(0, 5, 20)).toBe(0);
  });
});

describe("openTextEditor", () => {
  it("throws when stdin/stdout are not TTYs", async () => {
    const stdin = new MockStdin();
    const stdout = new MockStdout();
    stdin.isTTY = false;

    await expect(openTextEditor({ deps: { stdin, stdout } })).rejects.toThrow(
      "Interactive editor requires a TTY.",
    );
  });

  it("sets up raw mode and restores terminal on completion", async () => {
    await new Promise<void>((resolve) => {
      const stdin = new MockStdin();
      const stdout = new MockStdout();

      const editorPromise = openTextEditor({ deps: { stdin, stdout } });

      stdin.emit("data", "ok\x04");
      editorPromise.then((value) => {
        expect(value).toBe("ok");
        expect(stdin.setRawMode).toHaveBeenCalledWith(true);
        expect(stdin.setRawMode).toHaveBeenCalledWith(false);
        expect(stdin.pause).toHaveBeenCalled();
        expect(stdout.write).toHaveBeenCalled();
        resolve();
      });
    });
  });

  it("inserts tabs when no completion is active", async () => {
    await new Promise<void>((resolve) => {
      const stdin = new MockStdin();
      const stdout = new MockStdout();

      const editorPromise = openTextEditor({ deps: { stdin, stdout } });

      stdin.emit("data", "a\tb\x04");
      editorPromise.then((value) => {
        expect(value).toBe("a\tb");
        resolve();
      });
    });
  });

  it("does not activate completion for an empty @ query", async () => {
    await new Promise<void>((resolve) => {
      const stdin = new MockStdin();
      const stdout = new MockStdout();

      const editorPromise = openTextEditor({ deps: { stdin, stdout } });

      stdin.emit("data", "@");
      const lastWrite = stdout.writes[stdout.writes.length - 1] ?? "";
      expect(lastWrite.includes("Autocomplete")).toBe(false);

      stdin.emit("data", "\t\x04");
      editorPromise.then((value) => {
        expect(value).toBe("@\t");
        resolve();
      });
    });
  });

  it("supports cursor movement across lines", async () => {
    await new Promise<void>((resolve) => {
      const stdin = new MockStdin();
      const stdout = new MockStdout();

      const editorPromise = openTextEditor({ deps: { stdin, stdout } });

      stdin.emit("data", "ab\ncd");
      stdin.emit("data", "\x1b[A");
      stdin.emit("data", "X");
      stdin.emit("data", "\x04");

      editorPromise.then((value) => {
        expect(value).toBe("abX\ncd");
        resolve();
      });
    });
  });

  it("cancels with Ctrl+C while completion is active", async () => {
    await new Promise<void>((resolve) => {
      withTempDir((dir) => {
        fs.writeFileSync(path.join(dir, "match.txt"), "ok");

        const stdin = new MockStdin();
        const stdout = new MockStdout();

        const editorPromise = openTextEditor({
          deps: { stdin, stdout, cwd: () => dir },
        });

        stdin.emit("data", "@ma");
        stdin.emit("data", "\x03");
        editorPromise.then((value) => {
          expect(value).toBeNull();
          resolve();
        });
      });
    });
  });

  it("uses the @ token closest to the cursor for completion", async () => {
    await new Promise<void>((resolve) => {
      withTempDir((dir) => {
        fs.writeFileSync(path.join(dir, "file-one.txt"), "ok");

        const stdin = new MockStdin();
        const stdout = new MockStdout();

        const editorPromise = openTextEditor({
          deps: { stdin, stdout, cwd: () => dir },
        });

        stdin.emit("data", "@first @fi\t\x04");
        editorPromise.then((value) => {
          expect(value).toBe(`@first ${"file-one.txt"}`);
          resolve();
        });
      });
    });
  });

  it("refreshes completion state after cursor moves", async () => {
    await new Promise<void>((resolve) => {
      withTempDir((dir) => {
        fs.writeFileSync(path.join(dir, "file-one.txt"), "ok");

        const stdin = new MockStdin();
        const stdout = new MockStdout();

        const editorPromise = openTextEditor({
          deps: { stdin, stdout, cwd: () => dir },
        });

        stdin.emit("data", "@fi");
        stdin.emit("data", "\x1b[D\x1b[D\x1b[D");
        stdin.emit("data", "\t\x04");
        editorPromise.then((value) => {
          expect(value).toBe(`\t@fi`);
          resolve();
        });
      });
    });
  });

  it("deactivates completion when the query becomes invalid", async () => {
    await new Promise<void>((resolve) => {
      withTempDir((dir) => {
        fs.writeFileSync(path.join(dir, "alpha.txt"), "ok");

        const stdin = new MockStdin();
        const stdout = new MockStdout();

        const editorPromise = openTextEditor({
          deps: { stdin, stdout, cwd: () => dir },
        });

        stdin.emit("data", "@a");
        stdin.emit("data", "\x7f");
        stdin.emit("data", "\t\x04");
        editorPromise.then((value) => {
          expect(value).toBe("@\t");
          resolve();
        });
      });
    });
  });

  it("refreshes completion matches after backspacing in the query", async () => {
    await new Promise<void>((resolve) => {
      withTempDir((dir) => {
        fs.writeFileSync(path.join(dir, "alpha.txt"), "ok");

        const stdin = new MockStdin();
        const stdout = new MockStdout();

        const editorPromise = openTextEditor({
          deps: { stdin, stdout, cwd: () => dir },
        });

        stdin.emit("data", "@az");
        stdin.emit("data", "\x7f");
        stdin.emit("data", "\t\x04");
        editorPromise.then((value) => {
          expect(value).toBe("alpha.txt");
          resolve();
        });
      });
    });
  });

  it("does not react to events after the editor exits", async () => {
    await new Promise<void>((resolve) => {
      const stdin = new MockStdin();
      const stdout = new MockStdout();
      const editorPromise = openTextEditor({ deps: { stdin, stdout } });

      stdin.emit("data", "ok\x04");
      editorPromise.then((value) => {
        expect(value).toBe("ok");
        const writeCount = stdout.writes.length;

        stdout.emit("resize");
        stdin.emit("data", "ignored");

        expect(stdout.writes.length).toBe(writeCount);
        resolve();
      });
    });
  });

  it("clamps completion navigation at the list bounds", async () => {
    await new Promise<void>((resolve) => {
      withTempDir((dir) => {
        fs.writeFileSync(path.join(dir, "alpha.txt"), "ok");
        fs.writeFileSync(path.join(dir, "file-two.txt"), "ok");

        const stdin = new MockStdin();
        const stdout = new MockStdout();
        const { buildPathIndex, filterCompletionMatches } = textEditorInternals;
        const index = buildPathIndex(dir, fs, path);
        const matches = filterCompletionMatches(index, "f");
        const expected = matches[matches.length - 1]?.value ?? "";

        const editorPromise = openTextEditor({
          deps: { stdin, stdout, cwd: () => dir },
        });

        stdin.emit("data", "@f\x1b[B\x1b[B\x1b[B\t\x04");
        editorPromise.then((value) => {
          expect(value).toBe(expected);
          resolve();
        });
      });
    });
  });

  it("merges lines on backspace at start of line", async () => {
    await new Promise<void>((resolve) => {
      const stdin = new MockStdin();
      const stdout = new MockStdout();

      const editorPromise = openTextEditor({ deps: { stdin, stdout } });

      stdin.emit("data", "ab\ncd");
      stdin.emit("data", "\x1b[D\x1b[D");
      stdin.emit("data", "\x7f");
      stdin.emit("data", "\x04");

      editorPromise.then((value) => {
        expect(value).toBe("abcd");
        resolve();
      });
    });
  });

  it("applies completion on Enter without inserting a newline", async () => {
    await new Promise<void>((resolve) => {
      withTempDir((dir) => {
        fs.writeFileSync(path.join(dir, "file-one.txt"), "ok");

        const stdin = new MockStdin();
        const stdout = new MockStdout();

        const editorPromise = openTextEditor({
          deps: { stdin, stdout, cwd: () => dir },
        });

        stdin.emit("data", "@file\n\x04");
        editorPromise.then((value) => {
          expect(value).toBe("file-one.txt");
          resolve();
        });
      });
    });
  });

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

  it("cycles completion selection with arrow keys", async () => {
    await new Promise<void>((resolve) => {
      withTempDir((dir) => {
        fs.writeFileSync(path.join(dir, "first.txt"), "ok");
        fs.writeFileSync(path.join(dir, "file-two.txt"), "ok");

        const stdin = new MockStdin();
        const stdout = new MockStdout();
        const { buildPathIndex, filterCompletionMatches } = textEditorInternals;
        const index = buildPathIndex(dir, fs, path);
        const matches = filterCompletionMatches(index, "fi");
        const expected = matches[1]?.value ?? matches[0]?.value ?? "";

        const editorPromise = openTextEditor({
          deps: { stdin, stdout, cwd: () => dir },
        });

        stdin.emit("data", "@fi\x1b[B\t\x04");
        editorPromise.then((value) => {
          expect(value).toBe(expected);
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

  it("refreshes display on resize events", async () => {
    await new Promise<void>((resolve) => {
      const stdin = new MockStdin();
      const stdout = new MockStdout();
      const editorPromise = openTextEditor({ deps: { stdin, stdout } });

      stdout.emit("resize");
      stdin.emit("data", "\x03");

      editorPromise.then((value) => {
        expect(value).toBeNull();
        expect(stdout.write).toHaveBeenCalled();
        resolve();
      });
    });
  });
});
