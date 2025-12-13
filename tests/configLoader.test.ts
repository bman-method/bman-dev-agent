import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DefaultConfigLoader } from "../src/configLoader";
import { Config } from "../src/types";

function withTempDir(fn: (dir: string) => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "config-"));
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe("DefaultConfigLoader", () => {
  it("applies defaults and creates config/output directories when config file is missing", () => {
    withTempDir((dir) => {
      const configPath = path.join(dir, ".bman", "config.json");
      const loader = new DefaultConfigLoader(configPath);

      const config = loader.load("main");

      expect(config.agent).toBe("codex");
      expect(config.tasksFile).toBe(path.join(dir, ".bman", "tracker", "main", "tasks.md"));
      expect(config.outputDir).toBe(path.join(dir, ".bman", "output"));

      expect(fs.existsSync(path.join(dir, ".bman"))).toBe(true);
      expect(fs.existsSync(path.join(dir, ".bman", "output"))).toBe(true);
      expect(fs.existsSync(path.join(dir, ".bman", "tracker", "main"))).toBe(true);
    });
  });

  it("loads values from config file while applying defaults and normalizing agent", () => {
    withTempDir((dir) => {
      const configDir = path.join(dir, ".bman");
      const configPath = path.join(configDir, "config.json");
      const outputDir = path.join(dir, "custom-output");

      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          agent: "Codex",
          tasksFile: "custom-tasks.md",
          outputDir,
        })
      );

      const loader = new DefaultConfigLoader(configPath);
      const config = loader.load("main");

      expect(config.agent).toBe("codex");
      expect(config.tasksFile).toBe("custom-tasks.md");
      expect(config.outputDir).toBe(outputDir);
      expect(fs.existsSync(outputDir)).toBe(true);
    });
  });

  it("validates supported agent and required fields", () => {
    const loader = new DefaultConfigLoader("unused");

    expect(() =>
      loader.validate({ agent: "other", tasksFile: "tasks.md", outputDir: ".out" } as Config)
    ).toThrow(/Unsupported agent/);

    expect(() =>
      loader.validate({ agent: "codex", tasksFile: "", outputDir: ".out" } as Config)
    ).toThrow(/tasksFile/);

    expect(() =>
      loader.validate({ agent: "codex", tasksFile: "tasks.md", outputDir: "" } as Config)
    ).toThrow(/outputDir/);
  });

  it("requires a branch name when tasksFile is not provided", () => {
    withTempDir((dir) => {
      const configPath = path.join(dir, ".bman", "config.json");
      const loader = new DefaultConfigLoader(configPath);

      expect(() => loader.load("   ")).toThrow(/Branch name is required/);
    });
  });
});
