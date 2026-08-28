export type FindingKind =
    | "missing"
    | "empty"
    | "placeholder"
    | "config-advisory"
    | "deprecated";

export interface Finding {
    severity: "error" | "warn";
    kind: FindingKind;
    message: string;
    section?: string;
    token?: string;
}

export function hasBlockingFindings(findings: Finding[]): boolean {
    return findings.some((finding) => finding.severity === "error");
}
