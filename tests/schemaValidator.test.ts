import { InferFromSchema, SchemaValidator } from "../src/schemaValidator";

const demoSchema = {
  title: { type: "string" },
  tags: { type: "string[]", required: false },
  published: { type: "boolean" },
} as const;

type Demo = InferFromSchema<typeof demoSchema>;

describe("SchemaValidator", () => {
  it("infers types and validates arrays", () => {
    const validator = new SchemaValidator(demoSchema);
    const parsed = validator.parse('{"title":"Post","published":true,"tags":["a","b"]}');
    const typed: Demo = parsed;

    expect(typed).toEqual({ title: "Post", published: true, tags: ["a", "b"] });
  });

  it("allows missing optional fields", () => {
    const validator = new SchemaValidator(demoSchema);
    const parsed = validator.parse('{"title":"Post","published":false}');

    expect(parsed).toEqual({ title: "Post", published: false });
  });

  it("rejects non-string arrays", () => {
    const validator = new SchemaValidator(demoSchema);

    expect(() => validator.parse('{"title":"Post","published":false,"tags":[1]}')).toThrow(
      /array of strings/
    );
  });
});
