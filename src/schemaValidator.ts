export type SchemaFieldType = "boolean" | "string" | "string[]";

export type SchemaField = {
  type: SchemaFieldType;
  descriptionOfContent?: string;
  required?: boolean;
  maxLines?: number;
  enum?: string[];
};

export type SchemaDefinition = Record<string, SchemaField>;

type FieldIsRequired<D extends SchemaField> = D["required"] extends false ? false : true;

export type InferField<D extends SchemaField> = D["type"] extends "boolean"
  ? boolean
  : D["type"] extends "string"
    ? string
    : D["type"] extends "string[]"
      ? string[]
      : never;

export type InferFromSchema<S extends SchemaDefinition> = {
  [K in keyof S as FieldIsRequired<S[K]> extends true ? K : never]: InferField<S[K]>;
} & {
  [K in keyof S as FieldIsRequired<S[K]> extends true ? never : K]?: InferField<S[K]>;
};

export class SchemaValidator<TSchema extends SchemaDefinition> {
  constructor(private readonly schema: TSchema) {}

  parse(json: string): InferFromSchema<TSchema> {
    if (typeof json !== "string") {
      throw new Error("Agent output must be a JSON string.");
    }

    const parsed = this.parseJson(json);
    if (!this.isObject(parsed)) {
      throw new Error("Agent output must be a JSON object.");
    }

    const record = parsed as Record<string, unknown>;
    for (const [fieldName, spec] of Object.entries(this.schema)) {
      this.validateField(record, fieldName, spec);
    }

    return record as InferFromSchema<TSchema>;
  }

  private parseJson(json: string): unknown {
    try {
      return JSON.parse(json) as unknown;
    } catch {
      throw new Error("Agent output must be valid JSON.");
    }
  }

  private validateField(obj: Record<string, unknown>, fieldName: string, spec: SchemaField): void {
    const required = spec.required !== false;
    if (!(fieldName in obj)) {
      if (required) {
        throw new Error(`Missing required field: ${fieldName}`);
      }
      return;
    }

    const value = obj[fieldName];
    if (value === undefined || value === null) {
      if (required) {
        throw new Error(`Missing required field: ${fieldName}`);
      }
      return;
    }

    switch (spec.type) {
      case "string":
        this.expectString(value, fieldName);
        if (spec.enum && !spec.enum.includes(value as string)) {
          throw new Error(
            `Field "${fieldName}" must be one of ${this.formatEnumOptions(spec.enum)}.`
          );
        }
        this.enforceMaxLines(value as string, fieldName, spec.maxLines);
        break;
      case "boolean":
        this.expectBoolean(value, fieldName);
        break;
      case "string[]":
        this.expectStringArray(value, fieldName);
        break;
      default:
        throw new Error(`Unsupported field type for "${fieldName}".`);
    }
  }

  private expectString(value: unknown, field: string): void {
    if (typeof value !== "string") {
      throw new Error(`Field "${field}" must be a string.`);
    }
  }

  private expectBoolean(value: unknown, field: string): void {
    if (typeof value !== "boolean") {
      throw new Error(`Field "${field}" must be a boolean.`);
    }
  }

  private expectStringArray(value: unknown, field: string): void {
    if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
      throw new Error(`Field "${field}" must be an array of strings.`);
    }
  }

  private enforceMaxLines(content: string, fieldName: string, maxLines?: number): void {
    if (!maxLines) {
      return;
    }
    const lines = content.split(/\r?\n/).length;
    if (lines > maxLines) {
      throw new Error(`Field "${fieldName}" exceeds maxLines (${maxLines}).`);
    }
  }

  private isObject(value: unknown): value is object {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  private formatEnumOptions(options: string[]): string {
    if (options.length === 1) {
      return `"${options[0]}"`;
    }
    const [last, ...rest] = options.slice().reverse();
    return `${rest.reverse().map((opt) => `"${opt}"`).join(", ")}, or "${last}"`;
  }
}
