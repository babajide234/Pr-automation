export interface EnvConfig {
    GITHUB_TOKEN: string;
    GITHUB_REPO_OWNER: string;
    GITHUB_REPO_NAME: string;
    PR_NUMBER: string;

    GOOGLE_SERVICE_ACCOUNT: string;
    GOOGLE_DOC_ID: string;

    NODE_ENV: "development" | "production" | "test";
}