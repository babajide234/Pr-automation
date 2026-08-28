import { describe, expect, it } from "vitest";
import { ENGINE_DEFAULTS } from "../../infrastructure/config/defaults";
import { ExemptionService } from "./exemption.service";

const service = new ExemptionService();

describe("ExemptionService", () => {
    it("exempts configured bot authors", () => {
        const result = service.evaluate(
            { author: "dependabot[bot]", labels: [], draft: false },
            ENGINE_DEFAULTS,
        );
        expect(result.exempt).toBe(true);
        expect(result.reason).toContain("dependabot[bot]");
    });

    it("exempts configured labels", () => {
        const result = service.evaluate(
            { author: "alice", labels: ["dependencies"], draft: false },
            ENGINE_DEFAULTS,
        );
        expect(result.exempt).toBe(true);
        expect(result.reason).toContain("dependencies");
    });

    it("exempts draft PRs by default", () => {
        const result = service.evaluate(
            { author: "alice", labels: [], draft: true },
            ENGINE_DEFAULTS,
        );
        expect(result.exempt).toBe(true);
        expect(result.reason).toMatch(/draft/i);
    });

    it("does not exempt a human non-draft PR", () => {
        const result = service.evaluate(
            { author: "alice", labels: [], draft: false },
            ENGINE_DEFAULTS,
        );
        expect(result.exempt).toBe(false);
    });
});
