import { describe, expect, it } from "vitest";
import { ENGINE_DEFAULTS } from "./defaults";
import { defaultProvenance } from "./merge";
import { printResolvedConfig } from "./print";

describe("printResolvedConfig", () => {
    it("includes provenance and redacts credential-shaped values", () => {
        const printed = printResolvedConfig({
            config: {
                ...ENGINE_DEFAULTS,
                destinations: {
                    ...ENGINE_DEFAULTS.destinations,
                    google_docs: {
                        enabled: true,
                        document_id: "ghp_shouldneverbehere",
                    },
                },
            },
            provenance: defaultProvenance(),
            warnings: [],
            source: "working-tree",
        });

        expect(printed).toContain("provenance:");
        expect(printed).toContain("working-tree");
        expect(printed).not.toContain("ghp_shouldneverbehere");
        expect(printed).toContain("***");
    });
});
