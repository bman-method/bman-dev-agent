import { OutputContract } from "./types";

// Minimal, human-readable contract shared by prompt builder and validator.
export const DefaultOutputContract: OutputContract = {
  fields: [
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
  ],
};
