import fs from "node:fs";
import { agentOutputSchema } from "./agentOutputSchema";
import { SchemaValidator } from "./schemaValidator";
import { AgentOutput, ResultParser } from "./types";

const validator = new SchemaValidator(agentOutputSchema);

export class DefaultResultParser implements ResultParser {
  readAndValidate(path: string): AgentOutput {
    const content = fs.readFileSync(path, "utf8");
    return validator.parse(content);
  }
}
