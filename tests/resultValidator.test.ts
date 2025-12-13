import { DefaultOutputContract } from "../src/outputContract";
import { DefaultResultValidator } from "../src/resultValidator";

describe("DefaultResultValidator", () => {
  const validator = new DefaultResultValidator();

  it("validates and normalizes a correct payload", () => {
    const raw = {
      taskId: "T1",
      status: "success",
      commitMessage: "Did the thing",
      aiThoughts: "All good",
    };

    expect(validator.validate(raw, DefaultOutputContract)).toEqual(raw);
  });

  it("rejects non-object payloads", () => {
    expect(() => validator.validate(null as unknown as object, DefaultOutputContract)).toThrow(
      /must be a JSON object/
    );
    expect(() => validator.validate([] as unknown as object, DefaultOutputContract)).toThrow(
      /must be a JSON object/
    );
  });

  it("rejects missing required fields", () => {
    expect(() =>
      validator.validate({ taskId: "T1", status: "success" }, DefaultOutputContract)
    ).toThrow(/Missing required field: commitMessage/);
  });

  it("rejects invalid status values", () => {
    expect(() =>
      validator.validate(
        { taskId: "T1", status: "nope", commitMessage: "x", aiThoughts: "y" },
        DefaultOutputContract
      )
    ).toThrow(/must be one of "success", "blocked", or "failed"/);
  });

  it("rejects non-string fields", () => {
    expect(() =>
      validator.validate(
        { taskId: 1, status: "success", commitMessage: "x", aiThoughts: "y" },
        DefaultOutputContract
      )
    ).toThrow(/must be a string/);
  });

  it("rejects content exceeding maxLines", () => {
    const tooLong = {
      taskId: "T1",
      status: "success",
      commitMessage: "line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8\nline9\nline10\nline11",
      aiThoughts: "thoughts",
    };
    expect(() => validator.validate(tooLong, DefaultOutputContract)).toThrow(/exceeds maxLines/);
  });
});
