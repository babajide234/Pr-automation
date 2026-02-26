import { PRDocumentation } from "../models/pr-documentation";
import { ParsingService } from "./parsing.service";

export class NormalizationService {
    private parser = new ParsingService();

    normalize(pr: any): PRDocumentation {
        const body = pr.body;

        return {
            prNumber: pr.number,
            title: pr.title,
            author: pr.user.login,
            summary: this.parser.extractSection(body, "## Summary"),
            technicalDesign: this.parser.extractSection(body, "## Technical Design"),
            dbChanges: this.parser.extractSection(body, "## Database Changes"),
            apiChanges: this.parser.extractSection(body, "## API Changes"),
            breakingChanges: body.includes("Breaking Changes\nYes"),
            deploymentNotes: this.parser.extractSection(body, "## Deployment Notes"),
            rollbackPlan: this.parser.extractSection(body, "## Rollback Plan"),
            mergedAt: pr.merged_at,
        };
    }
}