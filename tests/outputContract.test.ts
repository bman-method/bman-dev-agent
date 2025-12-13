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
          "Full commit message (subject + body); imperative subject <=50 chars, blank line before body, ~72-char body focused on what/why.",
        maxLines: 10,
      },
      {
        name: "aiThoughts.changesMade",
        descriptionOfContent: "What changed in this task; keep concise but specific.",
        maxLines: 20,
      },
      {
        name: "aiThoughts.assumptions",
        descriptionOfContent: "Assumptions made; include context or leave \"None\" if not applicable.",
        maxLines: 20,
      },
      {
        name: "aiThoughts.decisionsTaken",
        descriptionOfContent: "Key decisions and rationale; include trade-offs considered.",
        maxLines: 20,
      },
      {
        name: "aiThoughts.pointsOfUnclarity",
        descriptionOfContent: 'Open questions or unclear areas (write "None" if none).',
        maxLines: 20,
      },
      {
        name: "aiThoughts.testsRun",
        descriptionOfContent: "Tests run and outcomes; state explicitly if no tests ran.",
        maxLines: 20,
      },
    ]);
  });
});
