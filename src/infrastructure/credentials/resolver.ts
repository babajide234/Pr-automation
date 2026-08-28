import { ConfigurationError } from "../../domain/errors";
import { CredentialName, CredentialProvider } from "./provider";

const CREDENTIAL_ENV_NAMES: Record<CredentialName, string> = {
    github_token: "GITHUB_TOKEN",
    google_service_account: "GOOGLE_SERVICE_ACCOUNT",
};

export class CredentialResolver {
    constructor(private readonly provider: CredentialProvider) {}

    resolve(name: CredentialName, required: boolean): string | undefined {
        const value = this.provider.resolve(name);
        if (required && !value) {
            throw new ConfigurationError(
                `Missing required credential: ${CREDENTIAL_ENV_NAMES[name]}`,
            );
        }
        return value;
    }
}
