import { COMMENT_MARKER } from "../config/constants";
import { Finding } from "../domain/models/findings";

export function formatValidationComment(
    findings: Finding[],
    options?: { exemptionReason?: string; configWarnings?: string[] },
): string {
    const lines = [COMMENT_MARKER, ""];

    if (options?.exemptionReason) {
        lines.push(`PR documentation check skipped: ${options.exemptionReason}.`);
        return lines.join("\n");
    }

    const blocking = findings.filter((finding) => finding.severity === "error");
    const warnings = findings.filter((finding) => finding.severity === "warn");

    if (blocking.length === 0 && warnings.length === 0) {
        lines.push("PR documentation looks complete.");
        appendConfigWarnings(lines, options?.configWarnings);
        return lines.join("\n");
    }

    lines.push("## PR documentation");
    lines.push("");

    if (blocking.length > 0) {
        lines.push("### Blocking");
        for (const finding of blocking) {
            lines.push(`- ${finding.message}`);
        }
        lines.push("");
    }

    if (warnings.length > 0) {
        lines.push("### Warnings");
        for (const finding of warnings) {
            lines.push(`- ${finding.message}`);
        }
        lines.push("");
    }

    appendConfigWarnings(lines, options?.configWarnings);
    return lines.join("\n").trimEnd() + "\n";
}

function appendConfigWarnings(lines: string[], warnings?: string[]): void {
    if (!warnings?.length) {
        return;
    }
    lines.push("### Config");
    for (const warning of warnings) {
        lines.push(`- ${warning}`);
    }
}
