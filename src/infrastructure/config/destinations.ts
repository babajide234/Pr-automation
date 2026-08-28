import { ConfigurationError } from "../../domain/errors";
import { ResolvedConfig } from "../../domain/models/config";
import { CredentialResolver } from "../credentials/resolver";

export function requireGoogleDocsCredential(
    config: ResolvedConfig,
    creds: CredentialResolver,
): string {
    if (!config.destinations.google_docs.enabled) {
        throw new ConfigurationError(
            "Google Docs is disabled; a Google credential should not be resolved.",
        );
    }
    if (!config.destinations.google_docs.document_id.trim()) {
        throw new ConfigurationError(
            "destinations.google_docs.document_id is required when destinations.google_docs.enabled is true.",
        );
    }
    return creds.resolve("google_service_account", true) as string;
}
