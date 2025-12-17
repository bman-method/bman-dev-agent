import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DefaultResultParser } from "../src/resultParser";

function withTempDir<T>(fn: (dir: string) => T): T {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "result-parser-"));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe("DefaultResultParser", () => {
  const thoughts = {
    changesMade: "All good",
    assumptions: "None",
    decisionsTaken: "Decided quickly",
    pointsOfUnclarity: "None",
    testsRun: "Not run",
  };

  it("reads and validates agent output from disk", () => {
    withTempDir((dir) => {
      const file = path.join(dir, "out.json");
      const payload = {
        taskId: "T1",
        status: "success",
        commitMessage: "Did the thing",
        ...thoughts,
      };
      fs.writeFileSync(file, JSON.stringify(payload));

      const parser = new DefaultResultParser();
      expect(parser.readAndValidate(file)).toEqual(payload);
    });
  });

  it("rejects invalid JSON content", () => {
    withTempDir((dir) => {
      const file = path.join(dir, "bad.json");
      fs.writeFileSync(file, "{not json");

      const parser = new DefaultResultParser();
      expect(() => parser.readAndValidate(file)).toThrow(/valid JSON/);
    });
  });

  it("rejects payloads missing required fields", () => {
    withTempDir((dir) => {
      const file = path.join(dir, "missing.json");
      const incomplete = { taskId: "T1", status: "success", ...thoughts };
      fs.writeFileSync(file, JSON.stringify(incomplete));

      const parser = new DefaultResultParser();
      expect(() => parser.readAndValidate(file)).toThrow(/Missing required field: commitMessage/);
    });
  });

  it("throws when the file does not exist", () => {
    const parser = new DefaultResultParser();
    expect(() => parser.readAndValidate("/non/existent.json")).toThrow();
  });
});
