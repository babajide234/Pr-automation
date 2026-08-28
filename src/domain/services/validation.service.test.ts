import { describe, expect, it } from "vitest";
import { ENGINE_DEFAULTS } from "../../infrastructure/config/defaults";
import { hasBlockingFindings } from "../models/findings";
import { ValidationService } from "./validation.service";

const validator = new ValidationService();

const completeBody = `## Summary
Ships the documentation engine as a reusable Action.

## Technical Design
Config is loaded from the base ref and passed into the domain.

## Rollback Plan
Revert the workflow file.
`;

describe("ValidationService", () => {
    it("uses the same three default headings as the engine schema", () => {
        expect(ENGINE_DEFAULTS.sections.map((section) => section.heading)).toEqual([
            "## Summary",
            "## Technical Design",
            "## Rollback Plan",
        ]);
        expect(validator.validate(completeBody, ENGINE_DEFAULTS)).toEqual([]);
    });

    it("reports missing headings as errors by default", () => {
        const findings = validator.validate("## Summary\nHello\n", ENGINE_DEFAULTS);
        expect(findings.some((finding) => finding.kind === "missing")).toBe(true);
        expect(hasBlockingFindings(findings)).toBe(true);
    });

    it("treats HTML comments and unticked checklists as empty", () => {
        const body = `## Summary
<!-- replace me -->
- [ ] still a template line

## Technical Design
Real design.

## Rollback Plan
Revert it.
`;
        const findings = validator.validate(body, ENGINE_DEFAULTS);
        expect(findings).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ kind: "empty", section: "## Summary" }),
            ]),
        );
    });

    it("does not fail the exit code for warn-only findings", () => {
        const config = {
            ...ENGINE_DEFAULTS,
            sections: ENGINE_DEFAULTS.sections.map((section) => ({
                ...section,
                severity: "warn" as const,
            })),
        };
        const findings = validator.validate("empty", config);
        expect(findings.length).toBeGreaterThan(0);
        expect(hasBlockingFindings(findings)).toBe(false);
    });

    it("ignores TODO inside a fenced code block", () => {
        const body = `## Summary
See the example.

\`\`\`ts
const TODO = 1;
\`\`\`

## Technical Design
Design.

## Rollback Plan
Revert.
`;
        expect(validator.validate(body, ENGINE_DEFAULTS)).toEqual([]);
    });

    it("does not match TODO as a substring of TODOMVC", () => {
        const body = `## Summary
Migrated the TODOMVC demo app.

## Technical Design
Design.

## Rollback Plan
Revert.
`;
        expect(validator.validate(body, ENGINE_DEFAULTS)).toEqual([]);
    });

    it("rejects lowercase tbd by default", () => {
        const body = `## Summary
tbd

## Technical Design
Design.

## Rollback Plan
Revert.
`;
        const findings = validator.validate(body, ENGINE_DEFAULTS);
        expect(findings).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ kind: "placeholder", token: "TBD" }),
            ]),
        );
    });

    it("does not report placeholders when the denylist is empty", () => {
        const config = {
            ...ENGINE_DEFAULTS,
            validation: {
                ...ENGINE_DEFAULTS.validation,
                reject_placeholders: [],
            },
        };
        const body = `## Summary
TBD

## Technical Design
Design.

## Rollback Plan
Revert.
`;
        expect(validator.validate(body, config)).toEqual([]);
    });
});
