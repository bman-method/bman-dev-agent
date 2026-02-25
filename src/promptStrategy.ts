import path from "node:path";
import { OutputContract, PromptInput, PromptStrategy, Task } from "./types";
const section = (title: string, body: string): string => {
    return `${title}:\n${body.trim()}`;
};

function formatTask(task: Task): string {
    const desc = task.description ? `\n${task.description}` : "";
    return `${task.id} - ${task.title}${desc}`;
}

function formatContract(contract: OutputContract): string {
    return contract.fields
        .map((field) => {
        const limit = field.maxLines ? ` (max ${field.maxLines} lines)` : "";
        return `- ${field.name}${limit}: ${field.descriptionOfContent}`;
    })
        .join("\n");
}

function formatCompletedTasks(tasks: Task[], currentId: string): string {
    const completed = tasks.filter((t) => t.id !== currentId && t.status === "done");
    if (completed.length === 0) {
        return "None.";
    }
    return completed
        .map((t) => `${t.id} [${t.status}] - ${t.title}`)
        .join("\n");
}
export class DefaultPromptStrategy implements PromptStrategy {
    build(input: PromptInput): string {
        const { task, runContext, contract, trackerDocument } = input;
        const outputPath = toCwdRelative(runContext.outputPath);
        const instructions = [
            "You are executing exactly one task.",
            "Write a single JSON object to the output file path provided below.",
            "Do not print the JSON; do not write anywhere else.",
            "Do not describe execution flow or git operations.",
        ].join("\n");
        const parts = [
            section("Tasks file prelude", trackerDocument.preludeText || "None."),
            section("Completed tasks", formatCompletedTasks(trackerDocument.tasks, task.id)),
            section("Task", formatTask(task)),
            section("Output file", outputPath),
            section("Output contract", formatContract(contract)),
            section("Instructions", instructions),
        ];
        return parts.join("\n\n").trimEnd();
    }
}

function toCwdRelative(outputPath: string): string {
    const absolutePath = path.isAbsolute(outputPath) ? outputPath : path.resolve(outputPath);
    return path.relative(process.cwd(), absolutePath) || ".";
}
