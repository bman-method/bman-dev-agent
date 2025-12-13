import { AiThoughts, AgentOutput, OutputContract, OutputContractField, RawAgentResult, ResultValidator, } from "./types";
const AI_THOUGHT_FIELDS: Array<keyof AiThoughts> = [
    "changesMade",
    "assumptions",
    "decisionsTaken",
    "pointsOfUnclarity",
    "testsRun",
];
export class DefaultResultValidator implements ResultValidator {
    validate(raw: RawAgentResult, contract: OutputContract): AgentOutput {
        if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
            throw new Error("Agent output must be a JSON object.");
        }
        const obj = raw as Record<string, unknown>;
        ensureFields(obj, contract.fields);
        const taskId = expectString(obj.taskId, "taskId");
        const status = expectStatus(obj.status);
        const commitMessage = expectString(obj.commitMessage, "commitMessage");
        const aiThoughts = expectAiThoughts(obj.aiThoughts);
        enforceMaxLines(commitMessage, contract, "commitMessage");
        AI_THOUGHT_FIELDS.forEach((field) => enforceMaxLines(aiThoughts[field], contract, `aiThoughts.${field}`));
        return { taskId, status, commitMessage, aiThoughts };
    }
}
function ensureFields(obj: Record<string, unknown>, fields: OutputContractField[]): void {
    for (const field of fields) {
        getFieldValue(obj, field.name);
    }
}
function getFieldValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split(".");
    let current: unknown = obj;
    for (const [idx, part] of parts.entries()) {
        if (current === null ||
            typeof current !== "object" ||
            Array.isArray(current) ||
            !(part in (current as Record<string, unknown>))) {
            throw new Error(`Missing required field: ${path}`);
        }
        current = (current as Record<string, unknown>)[part];
        const isLast = idx === parts.length - 1;
        if (!isLast && (current === null || typeof current !== "object" || Array.isArray(current))) {
            throw new Error(`Missing required field: ${path}`);
        }
    }
    return current;
}
function expectString(value: unknown, field: string): string {
    if (typeof value !== "string") {
        throw new Error(`Field "${field}" must be a string.`);
    }
    return value;
}
function expectAiThoughts(value: unknown): AiThoughts {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        throw new Error('Field "aiThoughts" must be an object containing structured sections.');
    }
    const obj = value as Record<string, unknown>;
    const thoughts: Partial<AiThoughts> = {};
    for (const section of AI_THOUGHT_FIELDS) {
        const sectionValue = obj[section];
        const fieldName = `aiThoughts.${section}`;
        if (typeof sectionValue !== "string") {
            throw new Error(`Field "${fieldName}" must be a string.`);
        }
        thoughts[section] = sectionValue;
    }
    return thoughts as AiThoughts;
}
function expectStatus(value: unknown): AgentOutput["status"] {
    if (value !== "success" && value !== "blocked" && value !== "failed") {
        throw new Error(`Field "status" must be one of "success", "blocked", or "failed".`);
    }
    return value;
}
function enforceMaxLines(content: string, contract: OutputContract, fieldName: string): void {
    const field = contract.fields.find((f) => f.name === fieldName);
    if (!field?.maxLines) {
        return;
    }
    const lines = content.split(/\r?\n/).length;
    if (lines > field.maxLines) {
        throw new Error(`Field "${fieldName}" exceeds maxLines (${field.maxLines}).`);
    }
}
