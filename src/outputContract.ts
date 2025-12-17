import { agentOutputSchema } from "./agentOutputSchema";
import { SchemaDefinition, SchemaField } from "./schemaValidator";
import { OutputContract } from "./types";

// Minimal, human-readable contract shared by prompt builder and validator.
export const DefaultOutputContract: OutputContract = buildOutputContract(agentOutputSchema);

function buildOutputContract(schema: SchemaDefinition): OutputContract {
  return {
    fields: Object.entries(schema).map(([name, spec]) => ({
      name,
      descriptionOfContent: formatDescription(spec),
      ...(spec.maxLines ? { maxLines: spec.maxLines } : {}),
    })),
  };
}

function formatDescription(spec: SchemaField): string {
  const description = spec.descriptionOfContent?.trim() ?? "";
  const typePrefix = `(type: ${spec.type})`;
  return description ? `${typePrefix} ${description}` : typePrefix;
}
