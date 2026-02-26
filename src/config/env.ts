import dotenv from "dotenv";
import { EnvConfig } from "./types";

dotenv.config();

function requireEnv(name: keyof EnvConfig): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

export const env: EnvConfig = {
    GITHUB_TOKEN: requireEnv("GITHUB_TOKEN"),
    GITHUB_REPO_OWNER: requireEnv("GITHUB_REPO_OWNER"),
    GITHUB_REPO_NAME: requireEnv("GITHUB_REPO_NAME"),
    PR_NUMBER: requireEnv("PR_NUMBER"),

    GOOGLE_SERVICE_ACCOUNT: requireEnv("GOOGLE_SERVICE_ACCOUNT"),
    GOOGLE_DOC_ID: requireEnv("GOOGLE_DOC_ID"),

    NODE_ENV: (process.env.NODE_ENV as any) || "development",
};