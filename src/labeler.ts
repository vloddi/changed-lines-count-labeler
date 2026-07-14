import * as core from "@actions/core";
import * as github from "@actions/github";
import * as yaml from "js-yaml";
import { Minimatch } from "minimatch";

interface LabelConfig {
  min?: number;
  max?: number;
}

interface Config {
  labels: Map<string, LabelConfig>;
  exclude: string[];
}

type ClientType = ReturnType<typeof github.getOctokit>;

export async function run() {
  try {
    const token = core.getInput("repo-token", { required: true });
    const configPath = core.getInput("configuration-path", { required: true });

    const prNumber = getPrNumber();
    if (!prNumber) {
      console.log("Could not get pull request number from context, exiting");
      return;
    }

    const client: ClientType = github.getOctokit(token);

    const { data: pullRequest } = await client.rest.pulls.get({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      pull_number: prNumber,
    });

    const config: Config = await getConfig(client, configPath);

    core.debug(`fetching changed files for pr #${prNumber}`);
    const changedLinesCnt: number =
      config.exclude.length > 0
        ? await getChangedLinesCountExcluding(client, prNumber, config.exclude)
        : pullRequest.additions + pullRequest.deletions;

    const labels: string[] = [];
    const labelsToRemove: string[] = [];
    for (const [label, labelConfig] of config.labels.entries()) {
      core.debug(`processing ${label}`);
      if (checkBoundaries(changedLinesCnt, labelConfig)) {
        labels.push(label);
      } else if (pullRequest.labels.find((l) => l.name === label)) {
        labelsToRemove.push(label);
      }
    }

    if (labels.length > 0) {
      await addLabels(client, prNumber, labels);
    }

    if (labelsToRemove.length > 0) {
      await removeLabels(client, prNumber, labelsToRemove);
    }
  } catch (error: any) {
    core.error(error);
    core.setFailed(error.message);
  }
}

function getPrNumber(): number | undefined {
  const pullRequest = github.context.payload.pull_request;
  if (!pullRequest) {
    return undefined;
  }

  return pullRequest.number;
}

async function getChangedLinesCountExcluding(
  client: ClientType,
  prNumber: number,
  exclude: string[]
): Promise<number> {
  const matchers = exclude.map((pattern) => new Minimatch(pattern, { dot: true }));
  const files = await client.paginate(client.rest.pulls.listFiles, {
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    pull_number: prNumber,
    per_page: 100,
  });

  return files
    .filter((file) => !matchers.some((matcher) => matcher.match(file.filename)))
    .reduce((sum, file) => sum + file.additions + file.deletions, 0);
}

async function getConfig(
  client: ClientType,
  configurationPath: string
): Promise<Config> {
  const configurationContent: string = await fetchContent(client, configurationPath);
  const configObject: any = yaml.load(configurationContent);
  return getConfigFromObject(configObject);
}

async function fetchContent(
  client: ClientType,
  repoPath: string
): Promise<string> {
  const response: any = await client.rest.repos.getContent({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    path: repoPath,
    ref: github.context.sha,
  });

  return Buffer.from(response.data.content, response.data.encoding).toString();
}

function getConfigFromObject(configObject: any): Config {
  const labels: Map<string, LabelConfig> = new Map();
  let exclude: string[] = [];
  for (const key in configObject) {
    if (key === "exclude") {
      if (!Array.isArray(configObject[key]) || configObject[key].some((p: any) => typeof p !== "string")) {
        throw Error(`unexpected type for "exclude" (should be an array of glob patterns)`);
      }
      exclude = configObject[key];
    } else if (configObject[key] instanceof Object) {
      labels.set(key, configObject[key]);
    } else {
      throw Error(`unexpected type for label ${key} (should be an object with min and/or max)`);
    }
  }

  return { labels, exclude };
}

export function checkBoundaries(cnt: number, labelConfig: LabelConfig): boolean {
  if ((labelConfig.min == undefined || labelConfig.min <= cnt) &&
      (labelConfig.max == undefined || cnt <= labelConfig.max)) {
    return true
  }
  return false;
}

async function addLabels(
  client: ClientType,
  prNumber: number,
  labels: string[]
) {
  await client.rest.issues.addLabels({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issue_number: prNumber,
    labels: labels,
  });
}

async function removeLabels(
  client: ClientType,
  prNumber: number,
  labels: string[]
) {
  await Promise.all(
    labels.map((label) =>
      client.rest.issues.removeLabel({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        issue_number: prNumber,
        name: label,
      })
    )
  );
}
