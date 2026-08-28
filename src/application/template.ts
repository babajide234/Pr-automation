import { ResolvedConfig } from "../domain/models/config";
import { PRDocumentation } from "../domain/models/pr-documentation";

export function formatArchiveBody(
    docs: PRDocumentation,
    config: ResolvedConfig,
): string {
    const sectionBlocks = config.sections
        .map((section) => {
            const body = docs.sections[section.extract_as] || "";
            return `${section.heading}\n${body}`.trimEnd();
        })
        .join("\n\n");

    return [
        `# PR #${docs.prNumber} – ${docs.title}`,
        "",
        `Author: ${docs.author}`,
        `Merged: ${docs.mergedAt ?? ""}`,
        "",
        sectionBlocks,
        "",
        "---------------------------------------",
        "",
    ].join("\n");
}

export function generateTemplate(config: ResolvedConfig): string {
    const blocks = config.sections
        .filter((section) => section.severity !== "off")
        .map((section) => {
            return [
                section.heading,
                "<!-- HTML comments are ignored by the documentation gate. Replace this guidance with real content. -->",
                "",
            ].join("\n");
        });

    return [
        "<!--",
        "  PR Title Format: <type>(<scope>): <subject>",
        "  Example: feat(api): add retry on upstream timeout",
        "-->",
        "",
        ...blocks,
    ].join("\n");
}
