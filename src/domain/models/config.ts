export type Severity = "error" | "warn" | "off";
export type PlaceholderScope = "required_sections" | "all_sections" | "body";
export type ProvenanceSource = "default" | "extends" | "local";
export type ConfigSource = "base-ref" | "working-tree" | "defaults";

export interface SectionConfig {
    heading: string;
    severity: Severity;
    extract_as: string;
}

export interface ExemptConfig {
    labels: string[];
    authors: string[];
    draft: boolean;
}

export interface ValidationConfig {
    reject_placeholders: string[];
    placeholder_case_sensitive: boolean;
    placeholder_scope: PlaceholderScope;
    fail_on_empty_required: boolean;
    exempt: ExemptConfig;
}

export interface DestinationsConfig {
    google_docs: {
        enabled: boolean;
        document_id: string;
    };
    json_artifact: {
        enabled: boolean;
    };
}

export interface TriggersConfig {
    validate_on: string[];
    archive_on: "merge";
}

export interface ResolvedConfig {
    version: 1;
    extends: string;
    sections: SectionConfig[];
    validation: ValidationConfig;
    destinations: DestinationsConfig;
    triggers: TriggersConfig;
}

export type ProvenanceMap = Record<string, ProvenanceSource>;

export interface LoadedConfig {
    config: ResolvedConfig;
    provenance: ProvenanceMap;
    warnings: string[];
    source: ConfigSource;
}
