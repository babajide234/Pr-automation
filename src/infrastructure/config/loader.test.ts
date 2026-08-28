import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import { ConfigurationError } from "../../domain/errors";
import { ConfigLoader, ConfigSourceClient } from "./loader";

function mockGithub(files: Record<string, string | null>): ConfigSourceClient {
    return {
        async assertRefExists(ref: string) {
            if (ref === "missing-sha") {
                throw new ConfigurationError(`Base ref '${ref}' is unreachable; cannot load config.`);
            }
        },
        async getFileAtRef(filePath: string, ref: string) {
            const key = `${ref}:${filePath}`;
            if (!(key in files)) {
                return null;
            }
            return files[key];
        },
    };
}

describe("ConfigLoader", () => {
    it("applies engine defaults when the base ref has no config file", async () => {
        const loader = new ConfigLoader();
        const { loaded } = await loader.load({
            configPath: ".pr-doc.yml",
            source: "base-ref",
            workingDirectory: process.cwd(),
            baseSha: "base-sha",
            github: mockGithub({}),
        });
        expect(loaded.source).toBe("defaults");
        expect(loaded.config.sections[0].heading).toBe("## Summary");
    });

    it("fails when the base SHA is unreachable", async () => {
        const loader = new ConfigLoader();
        await expect(
            loader.load({
                configPath: ".pr-doc.yml",
                source: "base-ref",
                workingDirectory: process.cwd(),
                baseSha: "missing-sha",
                github: mockGithub({}),
            }),
        ).rejects.toThrow(/unreachable/);
    });

    it("ignores a head config that turns every section off", async () => {
        const baseYaml = `
version: 1
sections:
  - heading: "## Summary"
    severity: error
    extract_as: summary
`;
        const headYaml = `
version: 1
sections:
  - heading: "## Summary"
    severity: off
    extract_as: summary
`;
        const loader = new ConfigLoader();
        const { loaded, headAdvisory } = await loader.load({
            configPath: ".pr-doc.yml",
            source: "base-ref",
            workingDirectory: process.cwd(),
            baseSha: "base-sha",
            headSha: "head-sha",
            github: mockGithub({
                "base-sha:.pr-doc.yml": baseYaml,
                "head-sha:.pr-doc.yml": headYaml,
            }),
        });

        expect(loaded.config.sections[0].severity).toBe("error");
        expect(headAdvisory.some((finding) => finding.kind === "config-advisory")).toBe(
            true,
        );
    });

    it("merges a local extends file under the working-tree config", async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pr-doc-config-"));
        try {
            fs.writeFileSync(
                path.join(dir, "base.yml"),
                `version: 1
validation:
  reject_placeholders: ["FIXME"]
`,
            );
            fs.writeFileSync(
                path.join(dir, ".pr-doc.yml"),
                `version: 1
extends: ./base.yml
destinations:
  json_artifact:
    enabled: false
`,
            );
            const loader = new ConfigLoader();
            const { loaded } = await loader.load({
                configPath: ".pr-doc.yml",
                source: "working-tree",
                workingDirectory: dir,
            });
            expect(loaded.config.validation.reject_placeholders).toEqual(["FIXME"]);
            expect(loaded.provenance["validation.reject_placeholders"]).toBe("extends");
            expect(loaded.config.destinations.json_artifact.enabled).toBe(false);
            expect(loaded.provenance["destinations.json_artifact.enabled"]).toBe("local");
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});
