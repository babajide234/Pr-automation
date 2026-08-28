import { z } from "zod";
import { ConfigurationError } from "../../domain/errors";
import {
    ResolvedConfig,
    SectionConfig,
    Severity,
} from "../../domain/models/config";
import { scanForSecrets } from "./secret-scan";

const severitySchema = z.enum(["error", "warn", "off"]);

const sectionSchema = z.object({
    heading: z.string().min(1),
    severity: severitySchema.optional(),
    required: z.boolean().optional(),
    extract_as: z.string().min(1).optional(),
});

const fileSchema = z
    .object({
        version: z.number().optional(),
        extends: z.string().optional(),
        sections: z.array(sectionSchema).optional(),
        validation: z
            .object({
                reject_placeholders: z.array(z.string()).optional(),
                placeholder_case_sensitive: z.boolean().optional(),
                placeholder_scope: z
                    .enum(["required_sections", "all_sections", "body"])
                    .optional(),
                fail_on_empty_required: z.boolean().optional(),
                exempt: z
                    .object({
                        labels: z.array(z.string()).optional(),
                        authors: z.array(z.string()).optional(),
                        draft: z.boolean().optional(),
                    })
                    .optional(),
            })
            .optional(),
        destinations: z
            .object({
                google_docs: z
                    .object({
                        enabled: z.boolean().optional(),
                        document_id: z.string().optional(),
                    })
                    .optional(),
                json_artifact: z
                    .object({
                        enabled: z.boolean().optional(),
                    })
                    .optional(),
            })
            .optional(),
        triggers: z
            .object({
                validate_on: z.array(z.string()).optional(),
                archive_on: z.literal("merge").optional(),
            })
            .optional(),
    })
    .strict();

export type ParsedSectionOverlay = {
    heading: string;
    severity?: Severity;
    extract_as: string;
};

export type ParsedExemptOverlay = {
    labels?: string[];
    authors?: string[];
    draft?: boolean;
};

export type ParsedConfigOverlay = {
    version?: 1;
    extends?: string;
    sections?: ParsedSectionOverlay[];
    validation?: {
        reject_placeholders?: string[];
        placeholder_case_sensitive?: boolean;
        placeholder_scope?: ResolvedConfig["validation"]["placeholder_scope"];
        fail_on_empty_required?: boolean;
        exempt?: ParsedExemptOverlay;
    };
    destinations?: {
        google_docs?: Partial<ResolvedConfig["destinations"]["google_docs"]>;
        json_artifact?: Partial<ResolvedConfig["destinations"]["json_artifact"]>;
    };
    triggers?: Partial<ResolvedConfig["triggers"]>;
};

export interface ParseResult {
    overlay: ParsedConfigOverlay;
    warnings: string[];
    empty: boolean;
}

function headingToExtractAs(heading: string): string {
    const words = heading
        .replace(/^#+\s*/, "")
        .replace(/[^a-zA-Z0-9\s]/g, "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (words.length === 0) {
        return "section";
    }

    const [first, ...rest] = words;
    return (
        first.toLowerCase() +
        rest.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join("")
    );
}

function normalizeSection(
    section: z.infer<typeof sectionSchema>,
    warnings: string[],
    index: number,
): SectionConfig {
    let severity: Severity = section.severity ?? "error";

    if (section.required !== undefined) {
        warnings.push(
            `sections[${index}].required is deprecated; use severity. It will be removed in v2.`,
        );
        if (section.severity === undefined) {
            severity = section.required ? "error" : "off";
        }
    }

    return {
        heading: section.heading,
        severity,
        extract_as: section.extract_as || headingToExtractAs(section.heading),
    };
}

export function parseConfigDocument(raw: unknown, sourceLabel: string): ParseResult {
    if (raw === null || raw === undefined || raw === "") {
        return { overlay: {}, warnings: [], empty: true };
    }

    if (typeof raw !== "object" || Array.isArray(raw)) {
        throw new ConfigurationError(`${sourceLabel} must be a YAML mapping.`);
    }

    scanForSecrets(raw);

    const keys = Object.keys(raw as object);
    if (keys.length === 0) {
        return { overlay: {}, warnings: [], empty: true };
    }

    const parsed = fileSchema.safeParse(raw);
    if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const path = issue.path.length ? issue.path.join(".") : "(root)";
        throw new ConfigurationError(
            `Invalid ${sourceLabel}: ${path} ${issue.message}`,
        );
    }

    const data = parsed.data;
    if (data.version !== undefined && data.version !== 1) {
        throw new ConfigurationError(
            `Unknown config version: ${data.version}. Only version 1 is supported.`,
        );
    }

    const hasPolicyKeys = keys.some((key) => key !== "version");
    if (hasPolicyKeys && data.version === undefined) {
        throw new ConfigurationError(
            `${sourceLabel} must set version: 1 when it contains policy keys.`,
        );
    }

    const warnings: string[] = [];
    const overlay: ParsedConfigOverlay = {};

    if (data.version === 1) {
        overlay.version = 1;
    }
    if (data.extends !== undefined) {
        overlay.extends = data.extends;
    }
    if (data.sections) {
        overlay.sections = data.sections.map((section, index) =>
            normalizeSection(section, warnings, index),
        );

        const headings = new Set<string>();
        const extractKeys = new Set<string>();
        for (const section of overlay.sections) {
            if (headings.has(section.heading)) {
                throw new ConfigurationError(
                    `${sourceLabel} has duplicate heading '${section.heading}'.`,
                );
            }
            if (extractKeys.has(section.extract_as)) {
                throw new ConfigurationError(
                    `${sourceLabel} has duplicate extract_as '${section.extract_as}'.`,
                );
            }
            headings.add(section.heading);
            extractKeys.add(section.extract_as);
        }
    }
    if (data.validation) {
        overlay.validation = {
            ...(data.validation.reject_placeholders !== undefined
                ? { reject_placeholders: data.validation.reject_placeholders }
                : {}),
            ...(data.validation.placeholder_case_sensitive !== undefined
                ? { placeholder_case_sensitive: data.validation.placeholder_case_sensitive }
                : {}),
            ...(data.validation.placeholder_scope !== undefined
                ? { placeholder_scope: data.validation.placeholder_scope }
                : {}),
            ...(data.validation.fail_on_empty_required !== undefined
                ? { fail_on_empty_required: data.validation.fail_on_empty_required }
                : {}),
            ...(data.validation.exempt
                ? {
                      exempt: {
                          ...(data.validation.exempt.labels !== undefined
                              ? { labels: data.validation.exempt.labels }
                              : {}),
                          ...(data.validation.exempt.authors !== undefined
                              ? { authors: data.validation.exempt.authors }
                              : {}),
                          ...(data.validation.exempt.draft !== undefined
                              ? { draft: data.validation.exempt.draft }
                              : {}),
                      },
                  }
                : {}),
        };
    }
    if (data.destinations) {
        overlay.destinations = data.destinations;
    }
    if (data.triggers) {
        overlay.triggers = data.triggers;
    }

    return { overlay, warnings, empty: false };
}
