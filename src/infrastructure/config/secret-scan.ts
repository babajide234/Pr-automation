import { ConfigurationError } from "../../domain/errors";

const TOKEN_PREFIXES = ["ghp_", "github_pat_"];

function looksLikeJsonWithPrivateKey(value: string): boolean {
    const trimmed = value.trim();
    if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
        return false;
    }
    try {
        const parsed = JSON.parse(trimmed) as Record<string, unknown>;
        return typeof parsed === "object" && parsed !== null && "private_key" in parsed;
    } catch {
        return false;
    }
}

function scanValue(value: unknown, keyPath: string): void {
    if (typeof value === "string") {
        if (value.includes("-----BEGIN ")) {
            throw new ConfigurationError(
                `Config key '${keyPath}' looks like a credential (PEM block) and must not be committed.`,
            );
        }
        if (looksLikeJsonWithPrivateKey(value)) {
            throw new ConfigurationError(
                `Config key '${keyPath}' looks like a credential (JSON private_key) and must not be committed.`,
            );
        }
        for (const prefix of TOKEN_PREFIXES) {
            if (value.includes(prefix)) {
                throw new ConfigurationError(
                    `Config key '${keyPath}' looks like a credential (${prefix} token) and must not be committed.`,
                );
            }
        }
        return;
    }

    if (Array.isArray(value)) {
        value.forEach((item, index) => scanValue(item, `${keyPath}[${index}]`));
        return;
    }

    if (value && typeof value === "object") {
        const record = value as Record<string, unknown>;
        if ("private_key" in record) {
            throw new ConfigurationError(
                `Config key '${keyPath}' looks like a credential (JSON private_key) and must not be committed.`,
            );
        }
        for (const [key, nested] of Object.entries(record)) {
            const next = keyPath ? `${keyPath}.${key}` : key;
            scanValue(nested, next);
        }
    }
}

export function scanForSecrets(value: unknown): void {
    scanValue(value, "");
}
