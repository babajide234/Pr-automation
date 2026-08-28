import fs from "fs";
import path from "path";
import YAML from "yaml";
import { ConfigurationError } from "../../domain/errors";
import { Finding } from "../../domain/models/findings";
import { LoadedConfig } from "../../domain/models/config";
import { resolveExtendsYaml } from "./extends";
import { resolveFromOverlays } from "./merge";
import { parseConfigDocument, ParsedConfigOverlay } from "./schema";

export interface ConfigSourceClient {
    getFileAtRef(path: string, ref: string): Promise<string | null>;
    assertRefExists(ref: string): Promise<void>;
}

export interface LoadConfigOptions {
    configPath: string;
    source: "base-ref" | "working-tree";
    workingDirectory: string;
    baseSha?: string;
    headSha?: string;
    github?: ConfigSourceClient;
}

export interface LoadConfigResult {
    loaded: LoadedConfig;
    headAdvisory: Finding[];
}

function parseYamlText(text: string, label: string): ParseAndWarn {
    const trimmed = text.trim();
    if (!trimmed) {
        return {
            overlay: {},
            warnings: [],
            empty: true,
        };
    }
    let raw: unknown;
    try {
        raw = YAML.parse(text);
    } catch (error) {
        const message = error instanceof Error ? error.message : "YAML parse error";
        throw new ConfigurationError(`Invalid YAML in ${label}: ${message}`);
    }
    return parseConfigDocument(raw, label);
}

type ParseAndWarn = ReturnType<typeof parseConfigDocument>;

async function overlayFromText(
    text: string,
    label: string,
    fromDir: string,
    layers: Array<{ overlay: ParsedConfigOverlay; source: "extends" | "local" }>,
    warnings: string[],
    seen: Set<string>,
    source: "extends" | "local",
): Promise<void> {
    const parsed = parseYamlText(text, label);
    warnings.push(...parsed.warnings);

    if (parsed.empty) {
        return;
    }

    const extendsSpec = parsed.overlay.extends?.trim();
    if (extendsSpec) {
        if (seen.has(extendsSpec)) {
            throw new ConfigurationError(
                `Circular extends detected at '${extendsSpec}'.`,
            );
        }
        seen.add(extendsSpec);
        const parentYaml = await resolveExtendsYaml(extendsSpec, fromDir);
        await overlayFromText(
            parentYaml,
            `extends '${extendsSpec}'`,
            fromDir,
            layers,
            warnings,
            seen,
            "extends",
        );
    }

    layers.push({ overlay: parsed.overlay, source });
}

async function resolveYamlLayers(
    text: string | null,
    label: string,
    fromDir: string,
    sourceKind: LoadedConfig["source"],
): Promise<LoadedConfig> {
    const warnings: string[] = [];
    const layers: Array<{ overlay: ParsedConfigOverlay; source: "extends" | "local" }> =
        [];

    if (text === null) {
        const { config, provenance } = resolveFromOverlays([]);
        return { config, provenance, warnings, source: "defaults" };
    }

    await overlayFromText(text, label, fromDir, layers, warnings, new Set(), "local");

    const { config, provenance } = resolveFromOverlays(layers);
    const emptyLocal = layers.length === 0;
    return {
        config,
        provenance,
        warnings,
        source: emptyLocal ? "defaults" : sourceKind,
    };
}

function collectConfigDiff(
    base: LoadedConfig["config"],
    head: LoadedConfig["config"],
): string[] {
    const diffs: string[] = [];
    if (JSON.stringify(base.sections) !== JSON.stringify(head.sections)) {
        diffs.push("sections");
    }
    if (JSON.stringify(base.validation) !== JSON.stringify(head.validation)) {
        diffs.push("validation");
    }
    if (JSON.stringify(base.destinations) !== JSON.stringify(head.destinations)) {
        diffs.push("destinations");
    }
    if (JSON.stringify(base.triggers) !== JSON.stringify(head.triggers)) {
        diffs.push("triggers");
    }
    return diffs;
}

export class ConfigLoader {
    async load(options: LoadConfigOptions): Promise<LoadConfigResult> {
        const fromDir = path.dirname(
            path.isAbsolute(options.configPath)
                ? options.configPath
                : path.join(options.workingDirectory, options.configPath),
        );
        const relativePath = options.configPath;
        let yamlText: string | null;
        let source: LoadedConfig["source"];

        if (options.source === "base-ref") {
            if (!options.github) {
                throw new ConfigurationError(
                    "GitHub client is required to load config from a base ref.",
                );
            }
            if (!options.baseSha) {
                throw new ConfigurationError(
                    "Base SHA is required to load config from a pull_request event.",
                );
            }
            await options.github.assertRefExists(options.baseSha);
            yamlText = await options.github.getFileAtRef(relativePath, options.baseSha);
            source = yamlText === null ? "defaults" : "base-ref";
        } else {
            const absolute = path.isAbsolute(relativePath)
                ? relativePath
                : path.join(options.workingDirectory, relativePath);
            if (!fs.existsSync(absolute)) {
                yamlText = null;
                source = "defaults";
            } else {
                yamlText = fs.readFileSync(absolute, "utf8");
                source = "working-tree";
            }
        }

        const loaded = await resolveYamlLayers(
            yamlText,
            relativePath,
            fromDir,
            source,
        );

        const headAdvisory: Finding[] = [];
        if (options.source === "base-ref" && options.headSha && options.github) {
            try {
                const headText = await options.github.getFileAtRef(
                    relativePath,
                    options.headSha,
                );
                if (headText !== null) {
                    const headLoaded = await resolveYamlLayers(
                        headText,
                        `head ${relativePath}`,
                        fromDir,
                        "working-tree",
                    );
                    const diffs = collectConfigDiff(loaded.config, headLoaded.config);
                    if (diffs.length > 0) {
                        headAdvisory.push({
                            severity: "warn",
                            kind: "config-advisory",
                            message:
                                `Head-branch ${relativePath} is not used on this PR; the base-branch policy applies until it is merged. Differences: ${diffs.join(", ")}.`,
                        });
                    }
                    for (const warning of headLoaded.warnings) {
                        headAdvisory.push({
                            severity: "warn",
                            kind: "config-advisory",
                            message: `Head-branch config: ${warning}`,
                        });
                    }
                }
            } catch (error) {
                const message =
                    error instanceof ConfigurationError
                        ? error.message
                        : "could not be parsed";
                headAdvisory.push({
                    severity: "warn",
                    kind: "config-advisory",
                    message: `Head-branch ${relativePath} is invalid and will not take effect until fixed and merged: ${message}`,
                });
            }
        }

        return { loaded, headAdvisory };
    }
}
