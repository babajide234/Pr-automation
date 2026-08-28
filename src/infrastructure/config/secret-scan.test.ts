import { describe, expect, it } from "vitest";
import { ConfigurationError } from "../../domain/errors";
import { scanForSecrets } from "./secret-scan";

describe("scanForSecrets", () => {
    it("allows ordinary policy values", () => {
        expect(() =>
            scanForSecrets({
                destinations: { google_docs: { document_id: "abc-123" } },
            }),
        ).not.toThrow();
    });

    it("fails closed on a PEM block", () => {
        expect(() =>
            scanForSecrets({ key: "-----BEGIN PRIVATE KEY-----\nabc\n" }),
        ).toThrow(ConfigurationError);
        expect(() =>
            scanForSecrets({ key: "-----BEGIN PRIVATE KEY-----\nabc\n" }),
        ).toThrow(/PEM/);
    });

    it("fails closed on JSON with private_key", () => {
        expect(() =>
            scanForSecrets({
                creds: '{"type":"service_account","private_key":"x"}',
            }),
        ).toThrow(/private_key/);
    });

    it("fails closed on ghp_ and github_pat_ prefixes", () => {
        expect(() => scanForSecrets({ token: "ghp_abcdefghijklmnopqrstuvwxyz" })).toThrow(
            /ghp_/,
        );
        expect(() =>
            scanForSecrets({ token: "github_pat_abcdefghijklmnopqrstuvwxyz" }),
        ).toThrow(/github_pat_/);
    });

    it("names the offending key", () => {
        expect(() =>
            scanForSecrets({ destinations: { google_docs: { document_id: "ghp_secretvalue" } } }),
        ).toThrow("destinations.google_docs.document_id");
    });
});
