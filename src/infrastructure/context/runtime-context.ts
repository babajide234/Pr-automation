import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { ConfigurationError } from "../../domain/errors";
import { DEFAULT_CONFIG_PATH } from "../../config/constants";

export type WorkflowMode = "validate" | "archive" | "noop";

export interface RuntimeContext {
    owner: string;
    repo: string;
    prNumber: number;
    eventName: string;
    eventAction?: string;
    merged: boolean;
    baseSha?: string;
    headSha?: string;
    mergeCommitSha?: string;
    configPath: string;
    isCI: boolean;
    requestedMode?: "validate" | "archive";
}

export interface CliContextOptions {
    pr?: number;
    repo?: string;
    config?: string;
    base?: string;
    mode?: "validate" | "archive";
}

interface GitHubPullRequestEvent {
    action?: string;
    number?: number;
    pull_request?: {
        number?: number;
        merged?: boolean;
        merge_commit_sha?: string | null;
        base?: { sha?: string };
        head?: { sha?: string };
    };
    repository?: {
        name?: string;
        owner?: { login?: string };
    };
}

function parseOwnerRepo(value: string): { owner: string; repo: string } {
    const cleaned = value
        .trim()
        .replace(/\.git$/, "")
        .replace(/\/$/, "");

    const ssh = cleaned.match(/^git@github\.com:(.+)$/);
    const https = cleaned.match(/^https?:\/\/github\.com\/(.+)$/);
    const slug = (ssh?.[1] ?? https?.[1] ?? cleaned).replace(/^\/+/, "");
    const [owner, repo, ...rest] = slug.split("/");

    if (!owner || !repo || rest.length > 0) {
        throw new ConfigurationError(
            `Invalid repository '${value}'. Expected owner/name.`,
        );
    }

    return { owner, repo };
}

function gitRemoteRepo(): { owner: string; repo: string } | undefined {
    try {
        const url = execSync("git remote get-url origin", {
            encoding: "utf8",
            stdio: ["pipe", "pipe", "pipe"],
        }).trim();
        if (!url) {
            return undefined;
        }
        return parseOwnerRepo(url);
    } catch {
        return undefined;
    }
}

export function resolveActionContext(): RuntimeContext {
    const repository = process.env.GITHUB_REPOSITORY;
    if (!repository) {
        throw new ConfigurationError(
            "GITHUB_REPOSITORY is missing. This entry point is for GitHub Actions.",
        );
    }

    const { owner, repo } = parseOwnerRepo(repository);
    const eventName = process.env.GITHUB_EVENT_NAME || "";
    const eventPath = process.env.GITHUB_EVENT_PATH;
    let event: GitHubPullRequestEvent = {};

    if (eventPath && fs.existsSync(eventPath)) {
        event = JSON.parse(fs.readFileSync(eventPath, "utf8")) as GitHubPullRequestEvent;
    }

    const prNumber = event.pull_request?.number ?? event.number;

    if (!prNumber) {
        throw new ConfigurationError(
            "Could not determine pull request number from the GitHub event payload.",
        );
    }

    const configPath =
        process.env.INPUT_CONFIG_PATH?.trim() || DEFAULT_CONFIG_PATH;

    return {
        owner: event.repository?.owner?.login || owner,
        repo: event.repository?.name || repo,
        prNumber,
        eventName,
        eventAction: event.action,
        merged: Boolean(event.pull_request?.merged),
        baseSha: event.pull_request?.base?.sha,
        headSha: event.pull_request?.head?.sha,
        mergeCommitSha: event.pull_request?.merge_commit_sha || undefined,
        configPath,
        isCI: true,
    };
}

export function resolveCliContext(options: CliContextOptions): RuntimeContext {
    const fromFlag = options.repo ? parseOwnerRepo(options.repo) : undefined;
    const fromGit = fromFlag ? undefined : gitRemoteRepo();
    const ownerRepo = fromFlag ?? fromGit;

    if (!ownerRepo) {
        throw new ConfigurationError(
            "Could not determine repository. Pass --repo owner/name or run inside a git checkout with an origin remote.",
        );
    }

    if (!options.pr || Number.isNaN(options.pr)) {
        throw new ConfigurationError("--pr is required for local runs.");
    }

    return {
        owner: ownerRepo.owner,
        repo: ownerRepo.repo,
        prNumber: options.pr,
        eventName: "cli",
        merged: options.mode === "archive",
        baseSha: options.base,
        configPath: options.config?.trim() || DEFAULT_CONFIG_PATH,
        isCI: false,
        requestedMode: options.mode,
    };
}

export function resolveWorkingDirectory(): string {
    return process.env.GITHUB_WORKSPACE || process.cwd();
}

export function resolveConfigAbsolutePath(configPath: string): string {
    if (path.isAbsolute(configPath)) {
        return configPath;
    }
    return path.join(resolveWorkingDirectory(), configPath);
}
