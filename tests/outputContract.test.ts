import { agentOutputSchema } from "../src/agentOutputSchema";
import { DefaultOutputContract } from "../src/outputContract";

describe("DefaultOutputContract", () => {
  it("defines the required fields with descriptions and optional maxLines", () => {
    expect(DefaultOutputContract.fields).toEqual([
      {
        name: "taskId",
        descriptionOfContent: "(type: string) The task id provided in the tasks file.",
      },
      {
        name: "status",
        descriptionOfContent: '(type: string) One of "success", "blocked", or "failed".',
      },
      {
        name: "commitMessage",
        descriptionOfContent:
          "(type: string) Full commit message (subject + body); imperative subject <=50 chars, blank line before body, ~72-char body focused on what/why.",
        maxLines: 10,
      },
      {
        name: "changesMade",
        descriptionOfContent: "(type: string) What changed in this task; keep concise but specific.",
        maxLines: 20,
      },
      {
        name: "assumptions",
        descriptionOfContent: '(type: string) Assumptions made; include context or leave "None" if not applicable.',
        maxLines: 20,
      },
      {
        name: "decisionsTaken",
        descriptionOfContent: "(type: string) Key decisions and rationale; include trade-offs considered.",
        maxLines: 20,
      },
      {
        name: "pointsOfUnclarity",
        descriptionOfContent: '(type: string) Open questions or unclear areas (write "None" if none).',
        maxLines: 20,
      },
      {
        name: "testsRun",
        descriptionOfContent: "(type: string) Tests run and outcomes; state explicitly if no tests ran.",
        maxLines: 20,
      },
    ]);
  });

  it("prefixes contract descriptions with the field type, keeping schema descriptions clean", () => {
    Object.values(agentOutputSchema).forEach((field) => {
      expect(field.descriptionOfContent?.startsWith("(type:")).toBe(false);
    });

    DefaultOutputContract.fields.forEach((field) => {
      const schemaField = agentOutputSchema[field.name as keyof typeof agentOutputSchema];
      const schemaDescription = schemaField.descriptionOfContent ?? "";
      const expectedDescription = schemaDescription
        ? `(type: ${schemaField.type}) ${schemaDescription}`
        : `(type: ${schemaField.type})`;
      expect(field.descriptionOfContent).toBe(expectedDescription);
    });
  });
});
