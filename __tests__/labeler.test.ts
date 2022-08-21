import {checkBoundaries} from "../src/labeler";

import * as core from "@actions/core";

jest.mock("@actions/core");

beforeAll(() => {
  jest.spyOn(core, "getInput").mockImplementation((name, options) => {
    return jest.requireActual("@actions/core").getInput(name, options);
  });
});

const config = { min: 2, max: 5 };

describe("checkBoundaries", () => {
  it("returns true when our boundaries include the number of changed files", () => {
    const result = checkBoundaries(2, config);
    expect(result).toBeTruthy();
  });

  it("returns false when our boundaries does not include the number of changed files", () => {
    const result = checkBoundaries(1, config);
    expect(result).toBeFalsy();
  });

  it("returns false when our boundaries does not include the number of changed files", () => {
    const result = checkBoundaries(6, config);
    expect(result).toBeFalsy();
  });
});
