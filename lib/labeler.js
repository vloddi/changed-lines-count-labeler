"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkBoundaries = exports.run = void 0;
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const yaml = __importStar(require("js-yaml"));
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const token = core.getInput("repo-token", { required: true });
            const configPath = core.getInput("configuration-path", { required: true });
            const prNumber = getPrNumber();
            if (!prNumber) {
                console.log("Could not get pull request number from context, exiting");
                return;
            }
            const client = github.getOctokit(token);
            const { data: pullRequest } = yield client.rest.pulls.get({
                owner: github.context.repo.owner,
                repo: github.context.repo.repo,
                pull_number: prNumber,
            });
            core.debug(`fetching changed files for pr #${prNumber}`);
            const changedLinesCnt = pullRequest.additions + pullRequest.deletions;
            const config = yield getConfig(client, configPath); // Label to its config
            const labels = [];
            const labelsToRemove = [];
            for (const [label, labelConfig] of config.entries()) {
                core.debug(`processing ${label}`);
                if (checkBoundaries(changedLinesCnt, labelConfig)) {
                    labels.push(label);
                }
                else if (pullRequest.labels.find((l) => l.name === label)) {
                    labelsToRemove.push(label);
                }
            }
            if (labels.length > 0) {
                yield addLabels(client, prNumber, labels);
            }
            if (labelsToRemove.length > 0) {
                yield removeLabels(client, prNumber, labelsToRemove);
            }
        }
        catch (error) {
            core.error(error);
            core.setFailed(error.message);
        }
    });
}
exports.run = run;
function getPrNumber() {
    const pullRequest = github.context.payload.pull_request;
    if (!pullRequest) {
        return undefined;
    }
    return pullRequest.number;
}
function getConfig(client, configurationPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const configurationContent = yield fetchContent(client, configurationPath);
        const configObject = yaml.load(configurationContent);
        return getLabelConfigMapFromObject(configObject);
    });
}
function fetchContent(client, repoPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield client.rest.repos.getContent({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            path: repoPath,
            ref: github.context.sha,
        });
        return Buffer.from(response.data.content, response.data.encoding).toString();
    });
}
function getLabelConfigMapFromObject(configObject) {
    const labelGlobs = new Map();
    for (const label in configObject) {
        if (configObject[label] instanceof Object) {
            labelGlobs.set(label, configObject[label]);
        }
        else {
            throw Error(`unexpected type for label ${label} (should be string or array of globs)`);
        }
    }
    return labelGlobs;
}
function checkBoundaries(cnt, labelConfig) {
    if ((labelConfig.min == undefined || labelConfig.min <= cnt) &&
        (labelConfig.max == undefined || cnt <= labelConfig.max)) {
        return true;
    }
    return false;
}
exports.checkBoundaries = checkBoundaries;
function addLabels(client, prNumber, labels) {
    return __awaiter(this, void 0, void 0, function* () {
        yield client.rest.issues.addLabels({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            issue_number: prNumber,
            labels: labels,
        });
    });
}
function removeLabels(client, prNumber, labels) {
    return __awaiter(this, void 0, void 0, function* () {
        yield Promise.all(labels.map((label) => client.rest.issues.removeLabel({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            issue_number: prNumber,
            name: label,
        })));
    });
}
