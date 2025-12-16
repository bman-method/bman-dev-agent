import fs from "node:fs";
import path from "node:path";
import { Task, TaskTracker, TaskTrackerDocument } from "./types";
type TaskStatus = Task["status"];
export class DefaultTaskTracker implements TaskTracker {
    constructor(private readonly tasksFile: string) { }

    loadDocument(): TaskTrackerDocument {
        const fullPath = this.resolvePath();
        const content = fs.readFileSync(fullPath, "utf8");
        return parseDocument(content);
    }

    pickNextTask(tasks: Task[]): Task | null {
        return tasks.find((task) => task.status === "open") ?? null;
    }

    markDone(tasks: Task[], taskId: string, _commitSha: string): Task[] {
        return this.updateStatus(tasks, taskId, "done");
    }

    markBlocked(tasks: Task[], taskId: string, _reason: string, _commitSha?: string): Task[] {
        return this.updateStatus(tasks, taskId, "blocked");
    }

    saveDocument(doc: TaskTrackerDocument): void {
        const fullPath = this.resolvePath();
        const content = serializeDocument(doc);
        fs.writeFileSync(fullPath, content, "utf8");
    }

    private updateStatus(tasks: Task[], taskId: string, status: TaskStatus): Task[] {
        let found = false;
        const updated = tasks.map((task) => {
            if (task.id !== taskId) {
                return task;
            }
            found = true;
            return { ...task, status };
        });
        if (!found) {
            throw new Error(`Task with id "${taskId}" not found.`);
        }
        return updated;
    }

    private resolvePath(): string {
        return path.resolve(this.tasksFile);
    }
}
const STATUS_SYMBOL_TO_STATUS: Record<string, Task["status"]> = {
    " ": "open",
    x: "done",
    "!": "blocked",
    "": "open",
};
const STATUS_TO_SYMBOL: Record<Task["status"], string> = {
    open: " ",
    done: "x",
    blocked: "!",
};
const TASK_LINE = /^\s*-\s*\[\s*([x!])?\s*\]\s+(\S+):\s*(.*)$/i;

function parseDocument(content: string): TaskTrackerDocument {
    const lines = content.split(/\r?\n/);
    const preludeLines: string[] = [];
    let i = 0;
    while (i < lines.length && !matchTaskLine(lines[i])) {
        preludeLines.push(lines[i]);
        i++;
    }
    const tasks: Task[] = [];
    while (i < lines.length) {
        const match = matchTaskLine(lines[i]);
        if (!match) {
            i++;
            continue;
        }
        const statusSymbol = (match[1] ?? "").toLowerCase() as keyof typeof STATUS_SYMBOL_TO_STATUS;
        const status = STATUS_SYMBOL_TO_STATUS[statusSymbol];
        const id = match[2].trim();
        const title = match[3].trim();
        if (!status) {
            throw new Error(`Unknown task status symbol: ${statusSymbol}`);
        }
        i++;
        const descriptionLines: string[] = [];
        while (i < lines.length && !matchTaskLine(lines[i])) {
            descriptionLines.push(lines[i]);
            i++;
        }
        const description = normalizeDescription(descriptionLines);
        ensureUniqueId(tasks, id);
        tasks.push({ id, title, description, status });
    }
    return {
        preludeText: preludeLines.join("\n"),
        tasks,
    };
}

function matchTaskLine(line: string): RegExpMatchArray | null {
    if (!line.trim()) {
        return null;
    }
    return line.match(TASK_LINE);
}

function trimEmptyLines(lines: string[]): string[] {
    let start = 0;
    let end = lines.length;
    while (start < end && lines[start].trim() === "") {
        start++;
    }
    while (end > start && lines[end - 1].trim() === "") {
        end--;
    }
    return lines.slice(start, end);
}

function normalizeDescription(lines: string[]): string {
    const trimmed = trimEmptyLines(lines);
    return trimmed.map((line) => line.trim()).join("\n");
}

function ensureUniqueId(tasks: Task[], id: string): void {
    if (tasks.some((task) => task.id === id)) {
        throw new Error(`Duplicate task id detected: ${id}`);
    }
}

function serializeTasksToLines(tasks: Task[]): string[] {
    const lines: string[] = [];
    tasks.forEach((task, index) => {
        const symbol = STATUS_TO_SYMBOL[task.status];
        if (!symbol) {
            throw new Error(`Unknown task status: ${task.status}`);
        }
        lines.push(`- [${symbol}] ${task.id}: ${task.title}`);
        if (task.description.trim()) {
            lines.push(...task.description.split(/\r?\n/));
        }
        if (index !== tasks.length - 1) {
            lines.push("");
        }
    });
    if (lines.length === 0 || lines[lines.length - 1] !== "") {
        lines.push("");
    }
    return lines;
}

function parseTasks(content: string): Task[] {
    return parseDocument(content).tasks;
}

function serializeTasks(tasks: Task[]): string {
    return serializeTasksToLines(tasks).join("\n");
}

function serializeDocument(doc: TaskTrackerDocument): string {
    const lines: string[] = [];
    if (doc.preludeText) {
        lines.push(...doc.preludeText.split(/\r?\n/));
        if (lines.length && lines[lines.length - 1] !== "") {
            lines.push("");
        }
    }
    lines.push(...serializeTasksToLines(doc.tasks));
    return lines.join("\n");
}
export { parseDocument, parseTasks, serializeDocument, serializeTasks };
