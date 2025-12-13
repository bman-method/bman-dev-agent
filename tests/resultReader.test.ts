import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DefaultResultReader } from "../src/resultReader";

function withTempDir<T>(fn: (dir: string) => T): T {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "result-reader-"));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe("DefaultResultReader", () => {
  it("reads and parses JSON from the given path", () => {
    withTempDir((dir) => {
      const file = path.join(dir, "out.json");
      fs.writeFileSync(file, JSON.stringify({ taskId: "T1", status: "success" }));

      const reader = new DefaultResultReader();
      const raw = reader.read(file) as { taskId: string; status: string };

      expect(raw).toEqual({ taskId: "T1", status: "success" });
    });
  });

  it("throws on invalid JSON", () => {
    withTempDir((dir) => {
      const file = path.join(dir, "bad.json");
      fs.writeFileSync(file, "{not valid");

      const reader = new DefaultResultReader();
      expect(() => reader.read(file)).toThrow();
    });
  });

  it("throws when the file does not exist", () => {
    const reader = new DefaultResultReader();
    expect(() => reader.read("/non/existent.json")).toThrow();
  });
});
