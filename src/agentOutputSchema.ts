import { InferFromSchema, SchemaDefinition } from "./schemaValidator";

export const agentOutputSchema = {
  taskId: {
    type: "string",
    descriptionOfContent: "The task id provided in the tasks file.",
  },
  status: {
    type: "string",
    descriptionOfContent:
      "The status of the task implementation, can be success or blocked. Note that if the implementation could not be completed or verified from any reason (network connectivity, test failure, compilation issues, linter issues or misunderstanding of the requirements), then the status should be blocked.",
    enum: ["success", "blocked"],
  },
  commitMessage: {
    type: "string",
    descriptionOfContent:
      "Full commit message (subject + body); imperative subject <=50 chars, blank line before body, ~72-char body focused on what/why.",
    maxLines: 10,
  },
  changesMade: {
    type: "string",
    descriptionOfContent: "What changed in this task; keep concise but specific.",
    maxLines: 20,
  },
  assumptions: {
    type: "string",
    descriptionOfContent: 'Assumptions made; include context or leave "None" if not applicable.',
    maxLines: 20,
  },
  decisionsTaken: {
    type: "string",
    descriptionOfContent: "Key decisions and rationale; include trade-offs considered.",
    maxLines: 20,
  },
  pointsOfUnclarity: {
    type: "string",
    descriptionOfContent: 'Open questions or unclear areas (write "None" if none).',
    maxLines: 20,
  },
  testsRun: {
    type: "string",
    descriptionOfContent: "Tests run and outcomes; state explicitly if no tests ran.",
    maxLines: 20,
  },
} as const satisfies SchemaDefinition;

export type AgentOutput = InferFromSchema<typeof agentOutputSchema>;
export type AgentOutputStatus = AgentOutput["status"];
