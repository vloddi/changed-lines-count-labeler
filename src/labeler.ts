import * as core from "@actions/core";
import * as github from "@actions/github";
import * as yaml from "js-yaml";

interface LabelConfig {
  min?: number;
  max?: number;
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

    core.debug(`fetching changed files for pr #${prNumber}`);
    const changedLinesCnt: number = pullRequest.additions + pullRequest.deletions;
    const config: Map<string, LabelConfig> = await getConfig(client, configPath); // Label to its config

    const labels: string[] = [];
    const labelsToRemove: string[] = [];
    for (const [label, labelConfig] of config.entries()) {
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

async function getConfig(
  client: ClientType,
  configurationPath: string
): Promise<Map<string, LabelConfig>> {
  const configurationContent: string = await fetchContent(client, configurationPath);
  const configObject: any = yaml.load(configurationContent);
  return getLabelConfigMapFromObject(configObject);
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

function getLabelConfigMapFromObject(
  configObject: any
): Map<string, LabelConfig> {
  const labelGlobs: Map<string, LabelConfig> = new Map();
  for (const label in configObject) {
    if (configObject[label] instanceof Object) {
      labelGlobs.set(label, configObject[label]);
    } else {
      throw Error(`unexpected type for label ${label} (should be string or array of globs)`);
    }
  }

  return labelGlobs;
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
