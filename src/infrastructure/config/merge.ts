import {
    ProvenanceMap,
    ProvenanceSource,
    ResolvedConfig,
} from "../../domain/models/config";
import { DEFAULT_PROVENANCE_KEYS, ENGINE_DEFAULTS } from "./defaults";
import { ParsedConfigOverlay } from "./schema";

function cloneDefaults(): ResolvedConfig {
    return JSON.parse(JSON.stringify(ENGINE_DEFAULTS)) as ResolvedConfig;
}

export function defaultProvenance(): ProvenanceMap {
    const provenance: ProvenanceMap = {};
    for (const key of DEFAULT_PROVENANCE_KEYS) {
        provenance[key] = "default";
    }
    return provenance;
}

export function applyOverlay(
    base: ResolvedConfig,
    overlay: ParsedConfigOverlay,
    source: ProvenanceSource,
    provenance: ProvenanceMap,
): ResolvedConfig {
    const result: ResolvedConfig = {
        ...base,
        validation: {
            ...base.validation,
            exempt: { ...base.validation.exempt },
        },
        destinations: {
            google_docs: { ...base.destinations.google_docs },
            json_artifact: { ...base.destinations.json_artifact },
        },
        triggers: { ...base.triggers },
        sections: [...base.sections],
    };

    if (overlay.version !== undefined) {
        result.version = overlay.version;
        provenance.version = source;
    }
    if (overlay.extends !== undefined) {
        result.extends = overlay.extends;
        provenance.extends = source;
    }
    if (overlay.sections !== undefined) {
        result.sections = overlay.sections.map((section) => ({
            heading: section.heading,
            severity: section.severity ?? "error",
            extract_as: section.extract_as || section.heading,
        }));
        provenance.sections = source;
    }

    if (overlay.validation) {
        const validation = overlay.validation;
        if (validation.reject_placeholders !== undefined) {
            result.validation.reject_placeholders = validation.reject_placeholders;
            provenance["validation.reject_placeholders"] = source;
        }
        if (validation.placeholder_case_sensitive !== undefined) {
            result.validation.placeholder_case_sensitive =
                validation.placeholder_case_sensitive;
            provenance["validation.placeholder_case_sensitive"] = source;
        }
        if (validation.placeholder_scope !== undefined) {
            result.validation.placeholder_scope = validation.placeholder_scope;
            provenance["validation.placeholder_scope"] = source;
        }
        if (validation.fail_on_empty_required !== undefined) {
            result.validation.fail_on_empty_required = validation.fail_on_empty_required;
            provenance["validation.fail_on_empty_required"] = source;
        }
        if (validation.exempt) {
            if (validation.exempt.labels !== undefined) {
                result.validation.exempt.labels = validation.exempt.labels;
                provenance["validation.exempt.labels"] = source;
            }
            if (validation.exempt.authors !== undefined) {
                result.validation.exempt.authors = validation.exempt.authors;
                provenance["validation.exempt.authors"] = source;
            }
            if (validation.exempt.draft !== undefined) {
                result.validation.exempt.draft = validation.exempt.draft;
                provenance["validation.exempt.draft"] = source;
            }
        }
    }

    if (overlay.destinations?.google_docs) {
        if (overlay.destinations.google_docs.enabled !== undefined) {
            result.destinations.google_docs.enabled =
                overlay.destinations.google_docs.enabled;
            provenance["destinations.google_docs.enabled"] = source;
        }
        if (overlay.destinations.google_docs.document_id !== undefined) {
            result.destinations.google_docs.document_id =
                overlay.destinations.google_docs.document_id;
            provenance["destinations.google_docs.document_id"] = source;
        }
    }
    if (overlay.destinations?.json_artifact?.enabled !== undefined) {
        result.destinations.json_artifact.enabled =
            overlay.destinations.json_artifact.enabled;
        provenance["destinations.json_artifact.enabled"] = source;
    }

    if (overlay.triggers?.validate_on !== undefined) {
        result.triggers.validate_on = overlay.triggers.validate_on;
        provenance["triggers.validate_on"] = source;
    }
    if (overlay.triggers?.archive_on !== undefined) {
        result.triggers.archive_on = overlay.triggers.archive_on;
        provenance["triggers.archive_on"] = source;
    }

    return result;
}

export function resolveFromOverlays(
    layers: Array<{ overlay: ParsedConfigOverlay; source: ProvenanceSource }>,
): { config: ResolvedConfig; provenance: ProvenanceMap } {
    let config = cloneDefaults();
    const provenance = defaultProvenance();
    for (const layer of layers) {
        config = applyOverlay(config, layer.overlay, layer.source, provenance);
    }
    return { config, provenance };
}
