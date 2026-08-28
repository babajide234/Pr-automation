import { ResolvedConfig } from "../models/config";

export interface ExemptionInput {
    author: string;
    labels: string[];
    draft: boolean;
}

export interface ExemptionResult {
    exempt: boolean;
    reason?: string;
}

export class ExemptionService {
    evaluate(pr: ExemptionInput, config: ResolvedConfig): ExemptionResult {
        const { exempt } = config.validation;
        const author = exempt.authors.find(
            (login) => login.toLowerCase() === pr.author.toLowerCase(),
        );
        if (author) {
            return {
                exempt: true,
                reason: `author '${pr.author}' is exempt`,
            };
        }

        const label = pr.labels.find((name) =>
            exempt.labels.some((rule) => rule.toLowerCase() === name.toLowerCase()),
        );
        if (label) {
            return {
                exempt: true,
                reason: `label '${label}' is exempt`,
            };
        }

        if (exempt.draft && pr.draft) {
            return {
                exempt: true,
                reason: "draft pull requests are exempt",
            };
        }

        return { exempt: false };
    }
}
