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
        descriptionOfContent: "Human-readable commit message summarizing the change.",
        maxLines: 10,
      },
      {
        name: "aiThoughts",
        descriptionOfContent: "Brief notes on what the AI did or why it blocked/failed.",
        maxLines: 100,
      },
    ]);
  });
});
