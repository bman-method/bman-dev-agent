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
    const aiThoughts = expectString(obj.aiThoughts, "aiThoughts");

    enforceMaxLines(commitMessage, contract, "commitMessage");
    enforceMaxLines(aiThoughts, contract, "aiThoughts");

    return { taskId, status, commitMessage, aiThoughts };
  }
}

function ensureFields(obj: Record<string, unknown>, fields: OutputContractField[]): void {
  for (const field of fields) {
    if (!(field.name in obj)) {
      throw new Error(`Missing required field: ${field.name}`);
    }
  }
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
  if (!field?.maxLines) return;

  const lines = content.split(/\r?\n/).length;
  if (lines > field.maxLines) {
    throw new Error(`Field "${fieldName}" exceeds maxLines (${field.maxLines}).`);
  }
}
