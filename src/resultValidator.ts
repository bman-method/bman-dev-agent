import { agentOutputSchema } from "./agentOutputSchema";
import { SchemaValidator } from "./schemaValidator";
import type { AgentOutput, OutputContract, RawAgentResult, ResultValidator } from "./types";

const validator = new SchemaValidator(agentOutputSchema);

export class DefaultResultValidator implements ResultValidator {
  validate(raw: RawAgentResult, contract: OutputContract): AgentOutput {
    void contract;
    return validator.parse(raw);
  }
}
