import { DefaultOutputContract } from "../src/outputContract";

describe("DefaultOutputContract", () => {
  it("defines the required fields with descriptions and optional maxLines", () => {
    expect(DefaultOutputContract.fields).toEqual([
      {
        name: "taskId",
        descriptionOfContent: "The task id provided in the tasks file.",
      },
      {
        name: "status",
        descriptionOfContent: 'One of "success", "blocked", or "failed".',
      },
      {
        name: "commitMessage",
        descriptionOfContent:
          "Human-readable commit message; imperative subject <=50 chars, blank line before body, ~72-char body focused on what/why.",
        maxLines: 10,
      },
      {
        name: "aiThoughts",
        descriptionOfContent:
          'Structured notes with all sections present: Changes made; Assumptions; Decisions taken; Points of unclarity (write "None" if none); Tests run status. Include each section even when empty.',
        maxLines: 100,
      },
    ]);
  });
});
