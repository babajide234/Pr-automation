import { describe, expect, it } from "vitest";
import { ENGINE_DEFAULTS } from "./defaults";
import { applyOverlay, defaultProvenance, resolveFromOverlays } from "./merge";

describe("config merge", () => {
    it("keeps engine defaults when no overlays are applied", () => {
        const { config, provenance } = resolveFromOverlays([]);
        expect(config.sections).toEqual(ENGINE_DEFAULTS.sections);
        expect(provenance.sections).toBe("default");
        expect(config.destinations.google_docs.enabled).toBe(false);
    });

    it("replaces arrays instead of appending", () => {
        const provenance = defaultProvenance();
        const merged = applyOverlay(
            ENGINE_DEFAULTS,
            {
                sections: [{ heading: "## Notes", severity: "warn", extract_as: "notes" }],
            },
            "local",
            provenance,
        );
        expect(merged.sections).toEqual([
            { heading: "## Notes", severity: "warn", extract_as: "notes" },
        ]);
        expect(provenance.sections).toBe("local");
    });

    it("applies extends under local", () => {
        const { config, provenance } = resolveFromOverlays([
            {
                overlay: {
                    validation: { reject_placeholders: ["FIXME"] },
                },
                source: "extends",
            },
            {
                overlay: {
                    destinations: { google_docs: { enabled: true, document_id: "doc-1" } },
                },
                source: "local",
            },
        ]);
        expect(config.validation.reject_placeholders).toEqual(["FIXME"]);
        expect(provenance["validation.reject_placeholders"]).toBe("extends");
        expect(config.destinations.google_docs.enabled).toBe(true);
        expect(provenance["destinations.google_docs.enabled"]).toBe("local");
    });
});
