import { Octokit } from "@octokit/rest";
import { ConfigurationError } from "../../domain/errors";
import { COMMENT_MARKER } from "../../config/constants";
import { ConfigSourceClient } from "../config/loader";

export interface GithubClientOptions {
    token: string;
    owner: string;
    repo: string;
}

export interface PullRequestData {
    number: number;
    title: string;
    body: string | null;
    user: { login: string };
    labels: { name: string }[];
    draft: boolean;
    merged: boolean;
    merged_at: string | null;
    base: { sha: string };
    head: { sha: string };
    merge_commit_sha: string | null;
}

function statusOf(error: unknown): number | undefined {
    if (error && typeof error === "object" && "status" in error) {
        return (error as { status: number }).status;
    }
    return undefined;
}

export class GithubClient implements ConfigSourceClient {
    private readonly client: Octokit;
    private readonly owner: string;
    private readonly repo: string;

    constructor(options: GithubClientOptions) {
        this.client = new Octokit({ auth: options.token });
        this.owner = options.owner;
        this.repo = options.repo;
    }

    async getPullRequest(prNumber: number): Promise<PullRequestData> {
        const { data } = await this.client.pulls.get({
            owner: this.owner,
            repo: this.repo,
            pull_number: prNumber,
        });

        return {
            number: data.number,
            title: data.title,
            body: data.body ?? null,
            user: { login: data.user?.login || "unknown" },
            labels: (data.labels || []).map((label) => ({
                name: typeof label === "string" ? label : label.name || "",
            })),
            draft: Boolean(data.draft),
            merged: Boolean(data.merged),
            merged_at: data.merged_at ?? null,
            base: { sha: data.base.sha },
            head: { sha: data.head.sha },
            merge_commit_sha: data.merge_commit_sha ?? null,
        };
    }

    async assertRefExists(ref: string): Promise<void> {
        try {
            await this.client.repos.getCommit({
                owner: this.owner,
                repo: this.repo,
                ref,
            });
        } catch (error) {
            const status = statusOf(error);
            if (status === 404 || status === 422) {
                throw new ConfigurationError(
                    `Base ref '${ref}' is unreachable; cannot load config.`,
                );
            }
            throw error;
        }
    }

    async getFileAtRef(filePath: string, ref: string): Promise<string | null> {
        try {
            const { data } = await this.client.repos.getContent({
                owner: this.owner,
                repo: this.repo,
                path: filePath,
                ref,
            });
            if (Array.isArray(data) || data.type !== "file" || !("content" in data) || !data.content) {
                return null;
            }
            return Buffer.from(data.content, "base64").toString("utf8");
        } catch (error) {
            if (statusOf(error) === 404) {
                return null;
            }
            throw error;
        }
    }

    async upsertComment(prNumber: number, body: string): Promise<void> {
        const comments = await this.client.paginate(this.client.issues.listComments, {
            owner: this.owner,
            repo: this.repo,
            issue_number: prNumber,
            per_page: 100,
        });
        const existing = comments.find((comment) => comment.body?.includes(COMMENT_MARKER));

        if (existing) {
            await this.client.issues.updateComment({
                owner: this.owner,
                repo: this.repo,
                comment_id: existing.id,
                body,
            });
            return;
        }

        await this.client.issues.createComment({
            owner: this.owner,
            repo: this.repo,
            issue_number: prNumber,
            body,
        });
    }
}
