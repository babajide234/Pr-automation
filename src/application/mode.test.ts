import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { ENGINE_DEFAULTS } from "../infrastructure/config/defaults";
import { resolveWorkflowMode } from "./mode";
import { RuntimeContext } from "../infrastructure/context/runtime-context";
import { generateTemplate } from "./template";
import { formatValidationComment } from "./comment";
import { COMMENT_MARKER } from "../config/constants";

function ctx(overrides: Partial<RuntimeContext>): RuntimeContext {
    return {
        owner: "acme",
        repo: "app",
        prNumber: 1,
        eventName: "pull_request",
        merged: false,
        configPath: ".pr-doc.yml",
        isCI: true,
        ...overrides,
    };
}

describe("resolveWorkflowMode", () => {
    it("validates on opened and archives on merged close", () => {
        expect(
            resolveWorkflowMode(ctx({ eventAction: "opened" }), ENGINE_DEFAULTS),
        ).toBe("validate");
        expect(
            resolveWorkflowMode(
                ctx({ eventAction: "closed", merged: true }),
                ENGINE_DEFAULTS,
            ),
        ).toBe("archive");
        expect(
            resolveWorkflowMode(
                ctx({ eventAction: "closed", merged: false }),
                ENGINE_DEFAULTS,
            ),
        ).toBe("noop");
    });

    it("honors a CLI requested mode", () => {
        expect(
            resolveWorkflowMode(
                ctx({ eventName: "cli", requestedMode: "validate" }),
                ENGINE_DEFAULTS,
            ),
        ).toBe("validate");
    });
});

describe("generateTemplate", () => {
    it("emits the same default headings as the engine schema", () => {
        const markdown = generateTemplate(ENGINE_DEFAULTS);
        for (const heading of ENGINE_DEFAULTS.sections.map((section) => section.heading)) {
            expect(markdown).toContain(heading);
        }
    });

    it("matches the shipped pull_request_template.md headings", () => {
        const template = fs.readFileSync(
            path.join(__dirname, "../../.github/pull_request_template.md"),
            "utf8",
        );
        for (const heading of ENGINE_DEFAULTS.sections.map((section) => section.heading)) {
            expect(template).toContain(heading);
        }
    });
});

describe("formatValidationComment", () => {
    it("uses a stable marker and lists blocking findings first", () => {
        const comment = formatValidationComment([
            { severity: "warn", kind: "empty", message: "Empty section: ## Notes" },
            { severity: "error", kind: "missing", message: "Missing heading: ## Summary" },
        ]);
        expect(comment.startsWith(COMMENT_MARKER)).toBe(true);
        const blockingAt = comment.indexOf("Missing heading");
        const warningAt = comment.indexOf("Empty section");
        expect(blockingAt).toBeGreaterThan(-1);
        expect(warningAt).toBeGreaterThan(blockingAt);
    });

    it("states the exemption rule", () => {
        const comment = formatValidationComment([], {
            exemptionReason: "author 'dependabot[bot]' is exempt",
        });
        expect(comment).toContain("dependabot[bot]");
    });
});
