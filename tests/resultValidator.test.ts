import { DefaultOutputContract } from "../src/outputContract";
import { DefaultResultValidator } from "../src/resultValidator";

describe("DefaultResultValidator", () => {
  const validator = new DefaultResultValidator();
  const thoughts = {
    changesMade: "All good",
    assumptions: "None",
    decisionsTaken: "Decided quickly",
    pointsOfUnclarity: "None",
    testsRun: "Not run",
  };

  it("validates and normalizes a correct payload", () => {
    const raw = {
      taskId: "T1",
      status: "success",
      commitMessage: "Did the thing",
      ...thoughts,
    };

    expect(validator.validate(JSON.stringify(raw), DefaultOutputContract)).toEqual(raw);
  });

  it("rejects non-object payloads", () => {
    expect(() => validator.validate("null", DefaultOutputContract)).toThrow(/must be a JSON object/);
    expect(() => validator.validate("[]", DefaultOutputContract)).toThrow(/must be a JSON object/);
  });

  it("rejects missing required fields", () => {
    expect(() =>
      validator.validate(JSON.stringify({ taskId: "T1", status: "success" }), DefaultOutputContract)
    ).toThrow(/Missing required field: commitMessage/);

    const { testsRun, ...incompleteThoughts } = thoughts;
    expect(() =>
      validator.validate(
        JSON.stringify({ taskId: "T1", status: "success", commitMessage: "x", ...incompleteThoughts }),
        DefaultOutputContract
      )
    ).toThrow(/Missing required field: testsRun/);
  });

  it("rejects invalid status values", () => {
    expect(() =>
      validator.validate(
        JSON.stringify({ taskId: "T1", status: "nope", commitMessage: "x", ...thoughts }),
        DefaultOutputContract
      )
    ).toThrow(/must be one of "success", "blocked", or "failed"/);
  });

  it("rejects non-string fields", () => {
    expect(() =>
      validator.validate(
        JSON.stringify({ taskId: 1, status: "success", commitMessage: "x", ...thoughts }),
        DefaultOutputContract
      )
    ).toThrow(/must be a string/);

    expect(() =>
      validator.validate(
        JSON.stringify({
          taskId: "T1",
          status: "success",
          commitMessage: "x",
          ...thoughts,
          assumptions: 123 as unknown as string,
        }),
        DefaultOutputContract
      )
    ).toThrow(/Field "assumptions" must be a string/);
  });

  it("rejects content exceeding maxLines", () => {
    const tooLong = {
      taskId: "T1",
      status: "success",
      commitMessage: "line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8\nline9\nline10\nline11",
      ...thoughts,
      testsRun:
        "line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8\nline9\nline10\nline11\nline12\nline13\nline14\nline15\nline16\nline17\nline18\nline19\nline20\nline21",
    };
    expect(() => validator.validate(JSON.stringify(tooLong), DefaultOutputContract)).toThrow(/exceeds maxLines/);
  });
});
