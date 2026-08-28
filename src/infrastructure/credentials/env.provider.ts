import { execSync } from "child_process";
import { CredentialName, CredentialProvider } from "./provider";

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
    for (const value of values) {
        if (value && value.trim()) {
            return value.trim();
        }
    }
    return undefined;
}

function tryGhAuthToken(): string | undefined {
    try {
        const token = execSync("gh auth token", {
            encoding: "utf8",
            stdio: ["pipe", "pipe", "pipe"],
        }).trim();
        return token || undefined;
    } catch {
        return undefined;
    }
}

export class EnvCredentialProvider implements CredentialProvider {
    resolve(name: CredentialName): string | undefined {
        if (name === "github_token") {
            return firstNonEmpty(
                process.env.INPUT_GITHUB_TOKEN,
                process.env.GITHUB_TOKEN,
                tryGhAuthToken(),
            );
        }

        return firstNonEmpty(
            process.env.INPUT_GOOGLE_CREDENTIALS,
            process.env.GOOGLE_SERVICE_ACCOUNT,
        );
    }
}
