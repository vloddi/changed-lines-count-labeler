import { run } from "../src/labeler";
import * as github from "@actions/github";
import * as core from "@actions/core";

const fs = jest.requireActual("fs");

jest.mock("@actions/core");
jest.mock("@actions/github");

const gh = github.getOctokit("_");
const addLabelsMock = jest.spyOn(gh.rest.issues, "addLabels");
const removeLabelMock = jest.spyOn(gh.rest.issues, "removeLabel");
const reposMock = jest.spyOn(gh.rest.repos, "getContent");
const getPullMock = jest.spyOn(gh.rest.pulls, "get");

const paginateMock = jest.spyOn(gh, "paginate");

const yamlFixtures = {
  "config.yml": fs.readFileSync("__tests__/fixtures/config.yml"),
  "config_with_exclude.yml": fs.readFileSync("__tests__/fixtures/config_with_exclude.yml"),
};

afterAll(() => jest.restoreAllMocks());

describe("run", () => {
  it("adds labels to PRs which changed file size is inside configured boundaries", async () => {
    usingLabelerConfigYaml("config.yml");
    getPullMock.mockResolvedValue(<any>{
      data: {
        additions: 1,
        deletions: 0,
        labels: [],
      },
    });

    await run();

    expect(removeLabelMock).toHaveBeenCalledTimes(0);
    expect(addLabelsMock).toHaveBeenCalledTimes(1);
    expect(addLabelsMock).toHaveBeenCalledWith({
      owner: "vkirilichev",
      repo: "changed-lines-count-labeler",
      issue_number: 1,
      labels: ["petit"],
    });
  });

  it("does not add labels to PRs which changed file size is outside of configured boundaries", async () => {
    usingLabelerConfigYaml("config.yml");
    getPullMock.mockResolvedValue(<any>{
      data: {
        additions: 5,
        deletions: 1,
        labels: [],
      },
    });

    await run();

    expect(removeLabelMock).toHaveBeenCalledTimes(0);
    expect(addLabelsMock).toHaveBeenCalledTimes(0);
  });

  it("ignores files matching exclude patterns when counting changed lines", async () => {
    usingLabelerConfigYaml("config_with_exclude.yml");
    getPullMock.mockResolvedValue(<any>{
      data: {
        additions: 503,
        deletions: 0,
        labels: [],
      },
    });
    paginateMock.mockResolvedValue(<any>[
      { filename: "src/main/Foo.kt", additions: 2, deletions: 1 },
      { filename: "module/src/test/FooTest.kt", additions: 400, deletions: 0 },
      { filename: "README.md", additions: 100, deletions: 0 },
    ]);

    await run();

    expect(removeLabelMock).toHaveBeenCalledTimes(0);
    expect(addLabelsMock).toHaveBeenCalledTimes(1);
    expect(addLabelsMock).toHaveBeenCalledWith({
      owner: "vkirilichev",
      repo: "changed-lines-count-labeler",
      issue_number: 1,
      labels: ["petit"],
    });
  });

  it("deletes existing PR labels that is not longer insode of configured boundaries", async () => {
    let mockInput = {
      "repo-token": "foo",
      "configuration-path": "bar"
    };

    jest
      .spyOn(core, "getInput")
      .mockImplementation((name: string, ...opts) => mockInput[name]);

    usingLabelerConfigYaml("config.yml");
    getPullMock.mockResolvedValue(<any>{
      data: {
        additions: 1,
        deletions: 0,
        labels: [{ name: "grande" }],
      },
    });

    await run();

    expect(addLabelsMock).toHaveBeenCalledTimes(1);
    expect(removeLabelMock).toHaveBeenCalledTimes(1);
    expect(removeLabelMock).toHaveBeenCalledWith({
      owner: "vkirilichev",
      repo: "changed-lines-count-labeler",
      issue_number: 1,
      name: "grande",
    });
  });
});

function usingLabelerConfigYaml(fixtureName: keyof typeof yamlFixtures): void {
  reposMock.mockResolvedValue(<any>{
    data: { content: yamlFixtures[fixtureName], encoding: "utf8" },
  });
}

