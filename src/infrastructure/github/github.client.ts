import { Octokit } from "@octokit/rest";
import { env } from "../../config/env";

export class GithubClient {
    private client = new Octokit({
        auth: env.GITHUB_TOKEN,
    });

    async getPullRequest() {
        const { data } = await this.client.pulls.get({
            owner: env.GITHUB_REPO_OWNER,
            repo: env.GITHUB_REPO_NAME,
            pull_number: Number(env.PR_NUMBER),
        });

        return data;
    }
}