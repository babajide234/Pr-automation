import { describe, expect, it } from "vitest";
import { ENGINE_DEFAULTS } from "../../infrastructure/config/defaults";
import { NormalizationService } from "./normalization.service";

describe("NormalizationService", () => {
    it("extracts sections by extract_as keys from config", () => {
        const docs = new NormalizationService().normalize(
            {
                number: 12,
                title: "Add engine",
                body: `## Summary
Hello

## Technical Design
World

## Rollback Plan
Revert
`,
                user: { login: "alice" },
                merged_at: "2026-08-26T00:00:00Z",
            },
            ENGINE_DEFAULTS,
        );

        expect(docs).toMatchObject({
            prNumber: 12,
            title: "Add engine",
            author: "alice",
            sections: {
                summary: "Hello",
                technicalDesign: "World",
                rollbackPlan: "Revert",
            },
        });
    });
});
