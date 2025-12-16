import { agentOutputSchema } from "./agentOutputSchema";
import { SchemaDefinition } from "./schemaValidator";
import { OutputContract } from "./types";

// Minimal, human-readable contract shared by prompt builder and validator.
export const DefaultOutputContract: OutputContract = buildOutputContract(agentOutputSchema);

function buildOutputContract(schema: SchemaDefinition): OutputContract {
  return {
    fields: Object.entries(schema).map(([name, spec]) => ({
      name,
      descriptionOfContent: spec.descriptionOfContent ?? "",
      ...(spec.maxLines ? { maxLines: spec.maxLines } : {}),
    })),
  };
}
