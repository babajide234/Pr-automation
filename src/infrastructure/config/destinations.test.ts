import { describe, expect, it } from "vitest";
import { ConfigurationError } from "../../domain/errors";
import { CredentialResolver } from "../credentials/resolver";
import { ENGINE_DEFAULTS } from "./defaults";
import { requireGoogleDocsCredential } from "./destinations";

describe("requireGoogleDocsCredential", () => {
    it("fails when enabled without a document_id", () => {
        const config = {
            ...ENGINE_DEFAULTS,
            destinations: {
                ...ENGINE_DEFAULTS.destinations,
                google_docs: { enabled: true, document_id: "" },
            },
        };
        const creds = new CredentialResolver({
            resolve: () => "not-used",
        });
        expect(() => requireGoogleDocsCredential(config, creds)).toThrow(
            /document_id is required/,
        );
        expect(() => requireGoogleDocsCredential(config, creds)).toThrow(
            ConfigurationError,
        );
    });

    it("fails when enabled without a resolvable credential", () => {
        const config = {
            ...ENGINE_DEFAULTS,
            destinations: {
                ...ENGINE_DEFAULTS.destinations,
                google_docs: { enabled: true, document_id: "doc-1" },
            },
        };
        const creds = new CredentialResolver({
            resolve: () => undefined,
        });
        expect(() => requireGoogleDocsCredential(config, creds)).toThrow(
            /GOOGLE_SERVICE_ACCOUNT/,
        );
    });
});
