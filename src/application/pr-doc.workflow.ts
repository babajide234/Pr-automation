import { GithubClient } from "../infrastructure/github/github.client";
import { ValidationService } from "../domain/services/validation.service";
import { NormalizationService } from "../domain/services/normalization.service";
import { GoogleDocsClient } from "../infrastructure/google/google-docs.client";
import { FileRepository } from "../infrastructure/storage/file.repository";

export class PRDocWorkflow {
    async execute() {
        const github = new GithubClient();
        const validator = new ValidationService();
        const normalizer = new NormalizationService();
        const googleDocs = new GoogleDocsClient();
        const fileRepo = new FileRepository();

        const pr = await github.getPullRequest();

        validator.validate(pr.body || "");

        const structured = normalizer.normalize(pr);

        fileRepo.save(structured);

        const formatted = `
            # PR #${structured.prNumber} – ${structured.title}

            Author: ${structured.author}
            Merged: ${structured.mergedAt}

            ## Summary
            ${structured.summary}

            ## Technical Design
            ${structured.technicalDesign}

            ## Rollback Plan
            ${structured.rollbackPlan}

            ---------------------------------------
        `;

        await googleDocs.append(formatted);
    }
}