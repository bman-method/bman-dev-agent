import { AgentOutput, OutputContract, OutputContractField, RawAgentResult, ResultValidator } from "./types";
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
        const changesMade = expectString(obj.changesMade, "changesMade");
        const assumptions = expectString(obj.assumptions, "assumptions");
        const decisionsTaken = expectString(obj.decisionsTaken, "decisionsTaken");
        const pointsOfUnclarity = expectString(obj.pointsOfUnclarity, "pointsOfUnclarity");
        const testsRun = expectString(obj.testsRun, "testsRun");
        const lineLimitedFields: Array<[keyof AgentOutput, string]> = [
            ["commitMessage", commitMessage],
            ["changesMade", changesMade],
            ["assumptions", assumptions],
            ["decisionsTaken", decisionsTaken],
            ["pointsOfUnclarity", pointsOfUnclarity],
            ["testsRun", testsRun],
        ];
        lineLimitedFields.forEach(([fieldName, value]) => enforceMaxLines(value, contract, fieldName));
        return {
            taskId,
            status,
            commitMessage,
            changesMade,
            assumptions,
            decisionsTaken,
            pointsOfUnclarity,
            testsRun,
        };
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
