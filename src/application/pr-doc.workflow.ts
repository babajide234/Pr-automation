import { GithubClient } from "../infrastructure/github/github.client";
import { ValidationService } from "../domain/services/validation.service";
import { NormalizationService } from "../domain/services/normalization.service";
import { GoogleDocsClient } from "../infrastructure/google/google-docs.client";
import { FileRepository } from "../infrastructure/storage/file.repository";

export class PRDocWorkflow {
    async execute() {
        // Initialize all dependencies
        const github = new GithubClient();
        const validator = new ValidationService();
        const normalizer = new NormalizationService();
        const googleDocs = new GoogleDocsClient();
        const fileRepo = new FileRepository();

        // Get the PR data from GitHub
        const pr = await github.getPullRequest();

        // Validate the PR data
        validator.validate(pr.body || "");

        // Normalize the PR data
        const structured = normalizer.normalize(pr);

        // Save the PR data to a file
        fileRepo.save(structured);

        // Format the PR data
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

        // Append the formatted PR data to Google Docs
        await googleDocs.append(formatted);
    }
}