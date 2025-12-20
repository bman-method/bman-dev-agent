import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DefaultConfigLoader } from "../src/configLoader";
import { Config } from "../src/types";
import { getTrackerFolderName } from "../src/tasksFile";

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

      expect(config.agent.default).toBe("codex");
      expect(config.agent.registry.codex?.cmd).toEqual([
        "codex",
        "exec",
        "--sandbox",
        "workspace-write",
        "--skip-git-repo-check",
        "-",
      ]);
      expect(config.agent.registry.gemini?.cmd).toEqual(["gemini", "--approval-mode", "auto_edit"]);
      expect(config.agent.registry.claude?.cmd).toEqual([
        "claude",
        "--allowedTools",
        "Read,Write,Bash",
        "--output-format",
        "json",
        "-p",
        "--verbose",
      ]);
      expect(config.tasksFile).toBe(path.join(dir, ".bman", "tracker", "main", "tasks.md"));
      expect(config.outputDir).toBe(path.join(dir, ".bman", "output"));

      expect(fs.existsSync(path.join(dir, ".bman"))).toBe(true);
      expect(fs.existsSync(path.join(dir, ".bman", "output"))).toBe(true);
      expect(fs.existsSync(path.join(dir, ".bman", "tracker", "main"))).toBe(true);
    });
  });

  it("encodes unsafe branch names when building the default tracker path", () => {
    withTempDir((dir) => {
      const configPath = path.join(dir, ".bman", "config.json");
      const loader = new DefaultConfigLoader(configPath);
      const branch = "ai/brrr feature*1";

      const config = loader.load(branch);
      const folder = getTrackerFolderName(branch);

      expect(config.tasksFile).toBe(path.join(dir, ".bman", "tracker", folder, "tasks.md"));
      expect(fs.existsSync(path.join(dir, ".bman", "tracker", folder))).toBe(true);
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
          agent: {
            default: "Codex",
          },
          tasksFile: "custom-tasks.md",
          outputDir,
        })
      );

      const loader = new DefaultConfigLoader(configPath);
      const config = loader.load("main");

      expect(config.agent.default).toBe("codex");
      expect(config.tasksFile).toBe("custom-tasks.md");
      expect(config.outputDir).toBe(outputDir);
      expect(fs.existsSync(outputDir)).toBe(true);
    });
  });

  it("validates supported agent registry entries and required fields", () => {
    const loader = new DefaultConfigLoader("unused");

    expect(() =>
      loader.validate({
        agent: {
          default: "other",
          registry: {
            codex: {
              cmd: ["codex"],
            },
          },
        },
        tasksFile: "tasks.md",
        outputDir: ".out",
      } as Config)
    ).toThrow(/agent.default/);

    expect(() =>
      loader.validate({
        agent: {
          default: "codex",
          registry: {
            codex: {
              cmd: [],
            },
          },
        },
        tasksFile: "",
        outputDir: ".out",
      } as Config)
    ).toThrow(/tasksFile/);

    expect(() =>
      loader.validate({
        agent: {
          default: "codex",
          registry: {
            codex: {
              cmd: ["codex"],
            },
          },
        },
        tasksFile: "tasks.md",
        outputDir: "",
      } as Config)
    ).toThrow(/outputDir/);

    expect(() =>
      loader.validate({
        agent: {
          default: "codex",
          registry: {
            codex: {
              cmd: [],
            },
          },
        },
        tasksFile: "tasks.md",
        outputDir: ".out",
      } as Config)
    ).toThrow(/agent.registry.codex.cmd/);

    expect(() =>
      loader.validate({
        agent: {
          default: "custom",
          registry: {
            custom: {
              cmd: [],
            },
          },
        },
        tasksFile: "tasks.md",
        outputDir: ".out",
      } as Config)
    ).toThrow(/agent.registry.custom.cmd/);
  });

  it("requires a branch name when tasksFile is not provided", () => {
    withTempDir((dir) => {
      const configPath = path.join(dir, ".bman", "config.json");
      const loader = new DefaultConfigLoader(configPath);

      expect(() => loader.load("   ")).toThrow(/Branch name is required/);
    });
  });

  it("loads custom default agent and command from config", () => {
    withTempDir((dir) => {
      const configPath = path.join(dir, ".bman", "config.json");
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          agent: {
            default: "gemini-lite",
            registry: {
              "gemini-lite": { cmd: ["/bin/echo", "--flag"] },
            },
          },
          tasksFile: "tasks.md",
          outputDir: ".out",
        })
      );

      const loader = new DefaultConfigLoader(configPath);
      const config = loader.load("main");

      expect(config.agent.default).toBe("gemini-lite");
      expect(config.agent.registry["gemini-lite"]?.cmd).toEqual(["/bin/echo", "--flag"]);
      loader.validate(config);
    });
  });
});
