export interface PRDocumentation {
    prNumber: number;
    title: string;
    author: string;
    mergedAt: string | null;
    sections: Record<string, string>;
}
