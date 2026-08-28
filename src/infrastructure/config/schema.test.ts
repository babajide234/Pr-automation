import { describe, expect, it } from "vitest";
import { ConfigurationError } from "../../domain/errors";
import { parseConfigDocument } from "./schema";

describe("parseConfigDocument", () => {
    it("treats an empty mapping as empty", () => {
        expect(parseConfigDocument({}, "config").empty).toBe(true);
    });

    it("rejects unknown versions", () => {
        expect(() => parseConfigDocument({ version: 2 }, "config")).toThrow(
            /Unknown config version/,
        );
    });

    it("requires version when policy keys are present", () => {
        expect(() =>
            parseConfigDocument({ sections: [{ heading: "## Summary" }] }, "config"),
        ).toThrow(/version/);
    });

    it("maps deprecated required: true to severity error and warns", () => {
        const result = parseConfigDocument(
            {
                version: 1,
                sections: [{ heading: "## Summary", required: true, extract_as: "summary" }],
            },
            "config",
        );
        expect(result.overlay.sections?.[0].severity).toBe("error");
        expect(result.warnings[0]).toMatch(/deprecated/);
    });

    it("rejects duplicate headings", () => {
        expect(() =>
            parseConfigDocument(
                {
                    version: 1,
                    sections: [
                        { heading: "## Summary", extract_as: "a" },
                        { heading: "## Summary", extract_as: "b" },
                    ],
                },
                "config",
            ),
        ).toThrow(ConfigurationError);
    });
});
