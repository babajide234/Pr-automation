import { ResolvedConfig, SectionConfig } from "../models/config";
import { Finding } from "../models/findings";
import { ParsingService } from "./parsing.service";

function isReportable(
    section: SectionConfig,
): section is SectionConfig & { severity: "error" | "warn" } {
    return section.severity === "error" || section.severity === "warn";
}

export class ValidationService {
    constructor(private readonly parser = new ParsingService()) {}

    validate(body: string, config: ResolvedConfig): Finding[] {
        const findings: Finding[] = [];
        const reportable = config.sections.filter(isReportable);

        for (const section of reportable) {
            if (!this.parser.hasHeading(body, section.heading)) {
                findings.push({
                    severity: section.severity,
                    kind: "missing",
                    section: section.heading,
                    message: `Missing heading: ${section.heading}`,
                });
                continue;
            }

            if (config.validation.fail_on_empty_required) {
                const sectionBody = this.parser.extractSection(body, section.heading);
                if (isEmptySection(sectionBody)) {
                    findings.push({
                        severity: section.severity,
                        kind: "empty",
                        section: section.heading,
                        message: `Empty section: ${section.heading}`,
                    });
                }
            }
        }

        findings.push(...this.findPlaceholders(body, config));
        return findings;
    }

    private findPlaceholders(body: string, config: ResolvedConfig): Finding[] {
        const tokens = config.validation.reject_placeholders;
        if (!tokens.length) {
            return [];
        }

        const findings: Finding[] = [];
        const caseSensitive = config.validation.placeholder_case_sensitive;
        const scope = config.validation.placeholder_scope;

        if (scope === "body") {
            const searchable = stripIgnored(body);
            for (const token of tokens) {
                if (containsToken(searchable, token, caseSensitive)) {
                    findings.push({
                        severity: "error",
                        kind: "placeholder",
                        token,
                        message: `Placeholder '${token}' found in the PR body`,
                    });
                }
            }
            return findings;
        }

        const sections =
            scope === "required_sections"
                ? config.sections.filter((section) => section.severity === "error")
                : config.sections.filter((section) => section.severity !== "off");

        for (const section of sections) {
            if (!this.parser.hasHeading(body, section.heading)) {
                continue;
            }
            const sectionBody = stripIgnored(
                this.parser.extractSection(body, section.heading),
            );
            for (const token of tokens) {
                if (containsToken(sectionBody, token, caseSensitive)) {
                    findings.push({
                        severity: section.severity === "warn" ? "warn" : "error",
                        kind: "placeholder",
                        token,
                        section: section.heading,
                        message: `Placeholder '${token}' found in ${section.heading}`,
                    });
                }
            }
        }

        return findings;
    }
}

export function stripIgnored(text: string): string {
    return text.replace(/```[\s\S]*?```/g, "").replace(/<!--[\s\S]*?-->/g, "");
}

export function isEmptySection(body: string): boolean {
    const withoutComments = body.replace(/<!--[\s\S]*?-->/g, "");
    const withoutUnticked = withoutComments.replace(/^\s*[-*]\s+\[\s?\]\s+.*$/gm, "");
    return withoutUnticked.trim().length === 0;
}

export function containsToken(
    text: string,
    token: string,
    caseSensitive: boolean,
): boolean {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const flags = caseSensitive ? "" : "i";
    return new RegExp(`\\b${escaped}\\b`, flags).test(text);
}
