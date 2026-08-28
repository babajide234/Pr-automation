import { ResolvedConfig } from "../models/config";
import { PRDocumentation } from "../models/pr-documentation";
import { ParsingService } from "./parsing.service";

export interface PullRequestInput {
    number: number;
    title: string;
    body: string | null;
    user: { login: string };
    merged_at: string | null;
}

export class NormalizationService {
    constructor(private readonly parser = new ParsingService()) {}

    normalize(pr: PullRequestInput, config: ResolvedConfig): PRDocumentation {
        const body = pr.body || "";
        const sections: Record<string, string> = {};

        for (const section of config.sections) {
            sections[section.extract_as] = this.parser.extractSection(body, section.heading);
        }

        return {
            prNumber: pr.number,
            title: pr.title,
            author: pr.user.login,
            mergedAt: pr.merged_at,
            sections,
        };
    }
}
