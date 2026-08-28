import { ResolvedConfig } from "../../domain/models/config";

export const ENGINE_DEFAULTS: ResolvedConfig = {
    version: 1,
    extends: "",
    sections: [
        { heading: "## Summary", severity: "error", extract_as: "summary" },
        { heading: "## Technical Design", severity: "error", extract_as: "technicalDesign" },
        { heading: "## Rollback Plan", severity: "error", extract_as: "rollbackPlan" },
    ],
    validation: {
        reject_placeholders: ["TBD", "TODO"],
        placeholder_case_sensitive: false,
        placeholder_scope: "required_sections",
        fail_on_empty_required: true,
        exempt: {
            labels: ["dependencies", "chore"],
            authors: ["dependabot[bot]", "renovate[bot]"],
            draft: true,
        },
    },
    destinations: {
        google_docs: {
            enabled: false,
            document_id: "",
        },
        json_artifact: {
            enabled: true,
        },
    },
    triggers: {
        validate_on: ["opened", "edited", "synchronize", "ready_for_review"],
        archive_on: "merge",
    },
};

export const DEFAULT_PROVENANCE_KEYS = [
    "version",
    "extends",
    "sections",
    "validation.reject_placeholders",
    "validation.placeholder_case_sensitive",
    "validation.placeholder_scope",
    "validation.fail_on_empty_required",
    "validation.exempt.labels",
    "validation.exempt.authors",
    "validation.exempt.draft",
    "destinations.google_docs.enabled",
    "destinations.google_docs.document_id",
    "destinations.json_artifact.enabled",
    "triggers.validate_on",
    "triggers.archive_on",
] as const;
