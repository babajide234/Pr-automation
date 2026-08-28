import { formatValidationComment } from "./comment";
import { resolveWorkflowMode } from "./mode";
import { formatArchiveBody } from "./template";
import { Finding, hasBlockingFindings } from "../domain/models/findings";
import { ExemptionService } from "../domain/services/exemption.service";
import { NormalizationService } from "../domain/services/normalization.service";
import { ValidationService } from "../domain/services/validation.service";
import { ConfigLoader } from "../infrastructure/config/loader";
import {
    RuntimeContext,
    resolveWorkingDirectory,
    WorkflowMode,
} from "../infrastructure/context/runtime-context";
import { CredentialResolver } from "../infrastructure/credentials/resolver";
import { GithubClient, GithubClientOptions } from "../infrastructure/github/github.client";
import { FileRepository } from "../infrastructure/storage/file.repository";
import { requireGoogleDocsCredential } from "../infrastructure/config/destinations";

export interface WorkflowResult {
    exitCode: number;
    mode: WorkflowMode;
    findings: Finding[];
}

export interface PRDocWorkflowDependencies {
    githubFactory?: (options: GithubClientOptions) => GithubClient;
    googleDocsFactory?: (options: {
        credentials: string;
        documentId: string;
    }) => { append(content: string): Promise<void> };
    fileRepo?: FileRepository;
    loader?: ConfigLoader;
}

export class PRDocWorkflow {
    private readonly validator = new ValidationService();
    private readonly normalizer = new NormalizationService();
    private readonly exemptions = new ExemptionService();

    constructor(private readonly deps: PRDocWorkflowDependencies = {}) {}

    async execute(
        ctx: RuntimeContext,
        creds: CredentialResolver,
    ): Promise<WorkflowResult> {
        const token = creds.resolve("github_token", true) as string;
        const github =
            this.deps.githubFactory?.({
                token,
                owner: ctx.owner,
                repo: ctx.repo,
            }) ?? new GithubClient({ token, owner: ctx.owner, repo: ctx.repo });
        const loader = this.deps.loader ?? new ConfigLoader();
        const fileRepo = this.deps.fileRepo ?? new FileRepository();

        const pr = await github.getPullRequest(ctx.prNumber);
        const load = this.resolveConfigLoad(ctx, pr);

        const { loaded, headAdvisory } = await loader.load({
            configPath: ctx.configPath,
            source: load.source,
            workingDirectory: resolveWorkingDirectory(),
            baseSha: load.sha,
            headSha: load.source === "base-ref" ? ctx.headSha || pr.head.sha : undefined,
            github,
        });

        const mode = resolveWorkflowMode(
            {
                ...ctx,
                merged: ctx.merged || pr.merged,
                eventAction: ctx.eventAction,
            },
            loaded.config,
        );

        if (mode === "noop") {
            return { exitCode: 0, mode, findings: [] };
        }

        const exemption = this.exemptions.evaluate(
            {
                author: pr.user.login,
                labels: pr.labels.map((label) => label.name).filter(Boolean),
                draft: pr.draft,
            },
            loaded.config,
        );

        if (exemption.exempt) {
            if (mode === "validate") {
                await github.upsertComment(
                    pr.number,
                    formatValidationComment([], { exemptionReason: exemption.reason }),
                );
            }
            return { exitCode: 0, mode, findings: [] };
        }

        const findings = [
            ...this.validator.validate(pr.body || "", loaded.config),
            ...headAdvisory,
        ];
        for (const warning of loaded.warnings) {
            findings.push({
                severity: "warn",
                kind: "deprecated",
                message: warning,
            });
        }

        if (mode === "validate") {
            await github.upsertComment(pr.number, formatValidationComment(findings));
            return {
                exitCode: hasBlockingFindings(findings) ? 1 : 0,
                mode,
                findings,
            };
        }

        if (hasBlockingFindings(findings)) {
            await github.upsertComment(pr.number, formatValidationComment(findings));
            return { exitCode: 1, mode, findings };
        }

        const structured = this.normalizer.normalize(pr, loaded.config);

        if (loaded.config.destinations.json_artifact.enabled) {
            fileRepo.save(structured);
        }

        if (loaded.config.destinations.google_docs.enabled) {
            const googleCreds = requireGoogleDocsCredential(loaded.config, creds);
            const documentId = loaded.config.destinations.google_docs.document_id;
            const googleDocs =
                this.deps.googleDocsFactory?.({
                    credentials: googleCreds,
                    documentId,
                }) ??
                new (await import("../infrastructure/google/google-docs.client")).GoogleDocsClient({
                    credentials: googleCreds,
                    documentId,
                });
            await googleDocs.append(formatArchiveBody(structured, loaded.config));
        }

        return { exitCode: 0, mode, findings };
    }

    private resolveConfigLoad(
        ctx: RuntimeContext,
        pr: { base: { sha: string }; head: { sha: string }; merge_commit_sha: string | null },
    ): { source: "base-ref" | "working-tree"; sha?: string } {
        if (ctx.eventName === "pull_request") {
            if (ctx.eventAction === "closed" && ctx.merged) {
                return {
                    source: "base-ref",
                    sha: ctx.mergeCommitSha || pr.merge_commit_sha || pr.head.sha,
                };
            }
            return { source: "base-ref", sha: ctx.baseSha || pr.base.sha };
        }
        if (ctx.baseSha) {
            return { source: "base-ref", sha: ctx.baseSha };
        }
        return { source: "working-tree" };
    }
}
