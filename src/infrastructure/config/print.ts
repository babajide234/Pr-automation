import YAML from "yaml";
import { LoadedConfig } from "../../domain/models/config";
import { scanForSecrets } from "./secret-scan";

const REDACTED = "***";

function redact(value: unknown): unknown {
    try {
        scanForSecrets(value);
        return value;
    } catch {
        return REDACTED;
    }
}

function redactDeep(value: unknown): unknown {
    if (typeof value === "string") {
        return redact(value);
    }
    if (Array.isArray(value)) {
        return value.map((item) => redactDeep(item));
    }
    if (value && typeof value === "object") {
        const output: Record<string, unknown> = {};
        for (const [key, nested] of Object.entries(value)) {
            output[key] = redactDeep(nested);
        }
        return output;
    }
    return value;
}

export function printResolvedConfig(loaded: LoadedConfig): string {
    const payload = {
        source: loaded.source,
        warnings: loaded.warnings,
        provenance: loaded.provenance,
        config: redactDeep(loaded.config),
    };
    return YAML.stringify(payload);
}
