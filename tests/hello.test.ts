import { helloWorld } from "../src/index";

describe("helloWorld", () => {
  it("returns the expected greeting", () => {
    expect(helloWorld()).toBe("Hello, world!");
  });
});
