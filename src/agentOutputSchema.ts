import { InferFromSchema, SchemaDefinition } from "./schemaValidator";

export const agentOutputSchema = {
  taskId: {
    type: "string",
    descriptionOfContent: "(type: string) The task id provided in the tasks file.",
  },
  status: {
    type: "string",
    descriptionOfContent: '(type: string) One of "success", "blocked", or "failed".',
    enum: ["success", "blocked", "failed"],
  },
  commitMessage: {
    type: "string",
    descriptionOfContent:
      "(type: string) Full commit message (subject + body); imperative subject <=50 chars, blank line before body, ~72-char body focused on what/why.",
    maxLines: 10,
  },
  changesMade: {
    type: "string",
    descriptionOfContent: "(type: string) What changed in this task; keep concise but specific.",
    maxLines: 20,
  },
  assumptions: {
    type: "string",
    descriptionOfContent: '(type: string) Assumptions made; include context or leave "None" if not applicable.',
    maxLines: 20,
  },
  decisionsTaken: {
    type: "string",
    descriptionOfContent: "(type: string) Key decisions and rationale; include trade-offs considered.",
    maxLines: 20,
  },
  pointsOfUnclarity: {
    type: "string",
    descriptionOfContent: '(type: string) Open questions or unclear areas (write "None" if none).',
    maxLines: 20,
  },
  testsRun: {
    type: "string",
    descriptionOfContent: "(type: string) Tests run and outcomes; state explicitly if no tests ran.",
    maxLines: 20,
  },
} as const satisfies SchemaDefinition;

export type AgentOutput = InferFromSchema<typeof agentOutputSchema>;
export type AgentOutputStatus = AgentOutput["status"];
