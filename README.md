# PR Documentation Automation (pr-doc-engine)

A highly robust, modular, and automated engine that enforces Pull Request documentation standards and archives them securely to Google Docs and local JSON artifacts.

## Quick Start Checklist
- [ ] **Node.js**: Ensure Node v20+ is installed (`node -v`).
- [ ] **GitHub Access**: Obtain a Personal Access Token (`GITHUB_TOKEN`) with `repo` scope to read PR descriptions.
- [ ] **Google Cloud**: Create a GCP Service Account, enable the Google Docs API, and download the JSON key.
- [ ] **Encode Service Account**: Base64 encode the GCP JSON key to safely store it in CI/CD secrets.
- [ ] **Env Vars**: Copy `.env.example` to `.env` and inject your variables.
- [ ] **Install & Build**: Run `npm install` and `npm run build`.
- [ ] **Execute**: Run `npm start` to execute the pipeline against the target PR.

---

## Project Overview

### Architecture Diagram

```text
                      [ GitHub Webhook / Action ]
                                  │
                                  ▼
┌───────────────────────────────────────────────────────────────────┐
│                      Application Layer                            │
│ ┌───────────────────────────────────────────────────────────────┐ │
│ │                  PRDocWorkflow (Orchestrator)                 │ │
│ └──────┬──────────────────────┬───────────────────────┬─────────┘ │
└────────┼──────────────────────┼───────────────────────┼───────────┘
         │                      │                       │
         ▼                      ▼                       ▼
┌──────────────────┐  ┌──────────────────┐  ┌───────────────────────┐
│ Infrastructure   │  │ Domain Layer     │  │ Infrastructure Layer  │
│ (Input/Source)   │  │ (Core Logic)     │  │ (Output/Storage)      │
│                  │  │                  │  │                       │
│ - GithubClient   │  │ - ValidationSvc  │  │ - GoogleDocsClient    │
│                  │  │ - Normalization  │  │ - FileRepository      │
│                  │  │ - Models         │  │                       │
└──────────────────┘  └──────────────────┘  └───────────────────────┘
         │                                              │      │
         ▼                                              ▼      ▼
    [ GitHub API ]                                 [ G-Docs ] [ Disk ]
```

### Core Workflow
1. **Extraction**: `GithubClient` pulls the PR payload (status, author, body, commits).
2. **Validation**: `ValidationService` checks for required markdown sections (e.g., `## Summary`, `## Rollback Plan`) and rejects placeholder text (e.g., `TBD`).
3. **Normalization**: `NormalizationService` maps the raw PR data into a strongly-typed `PRDocumentation` model.
4. **Archival**: `FileRepository` writes the raw JSON artifact to disk for long-term historical audits.
5. **Publishing**: `GoogleDocsClient` formats the normalized data into a standard template and appends it to a centralized release notes or architecture document.

### Key Design Decisions
- **Layered Architecture (Ports & Adapters)**: External concerns (GitHub API, Google Docs) are kept strictly at the infrastructure layer. The domain contains pure business rules (validation logic), making the system highly testable without mocking HTTP calls everywhere.
- **Fail-Fast Validation**: The CI job fails immediately if the PR description lacks required operational sections, forcing engineers to write quality docs before merging.
- **Artifact Generation**: Alongside publishing to Google Docs, keeping a JSON artifact on disk allows for future database backfills, search indexing, or re-processing.

---

## Folder Structure

```text
src/
├── application/         # Orchestrators. Glues domain and infrastructure together.
│   └── pr-doc.workflow.ts 
├── domain/              # The core rules of the system. Absolute zero external dependencies.
│   ├── models/          # Entity types/interfaces (e.g., PRDocumentation).
│   └── services/        # Pure business logic (Validation, Normalization).
├── infrastructure/      # Everything that touches the outside world (I/O, Network).
│   ├── github/          # GitHub API integration.
│   ├── google/          # Google Workspace APIs.
│   └── storage/         # Local SSD / JSON artifact writers.
└── config/              # Environment binding and type-safety for configuration.
```

**Layering Philosophy**: 
- **Domain** knows nothing. 
- **Application** knows about Domain and Interfaces of Infrastructure. 
- **Infrastructure** implements specific vendor SDKs.

---

## Prerequisites
- **Node.js**: v20 or LTS equivalents.
- **Google Cloud**: A project with `Google Docs API` enabled. A Service Account with `Editor` access to the target Document ID.
- **GitHub**: Target repository must have Actions enabled. The workflow requires `contents: read` and `pull-requests: write` permissions.

---

## Environment Configuration

Create a `.env` file locally, or map these in GitHub Actions Secrets:

```dotenv
# GitHub
GITHUB_TOKEN=ghp_your_personal_access_token
GITHUB_REPOSITORY=owner/repo     # Format expected by Action
PR_NUMBER=123                    # Injected by CI

# Google Docs
GOOGLE_DOC_ID=1A2b3C4d5E6f7g8h9i0j-XYZ
GOOGLE_CREDENTIALS_BASE64=ewogICJ0eXBlIjog...
```

### Encoding Google Service Account Safely
Never store the raw JSON file in git. Encode it:
```bash
cat service-account.json | base64 > encoded.txt
```
Copy instructions from `encoded.txt` directly to `GOOGLE_CREDENTIALS_BASE64` in GitHub Secrets. The application will decode it in memory.

---

## Local Development Guide

### Installation & Running
```bash
npm install
npm run build
```

### Simulating PR Execution
To test locally, set a valid `PR_NUMBER` in your `.env` for an open PR on your configured repository, then run:
```bash
npm start
```

### Mocking GitHub Events
If you want to work completely offline, you can instantiate a mock version of `GithubClient` in `pr-doc.workflow.ts` that returns a static JavaScript object matching the expected PR payload.

---

## Testing Guide

### Strategy
- **Unit Tests (Domain)**: 100% coverage on `ValidationService` and `NormalizationService`. These should be pure functions. Inject various strings, assert errors are thrown or data is correctly shaped.
- **Integration Tests (Infrastructure)**: Test `GithubClient` against a public repository or mock the `@octokit/rest` HTTP calls using Nock or MSW. 

### Edge Cases to Test
- PR body is `null` (already patched in workflow).
- PR body contains the exact string "TBD" but in lower-case "tbd" (ensure validation handles case-insensitivity if required).
- Google Doc is locked or deleted.
- Rate limiting by GitHub (429 Too Many Requests).

### Simulating Failures
Intentionally break the Google base64 string or remove the `## Rollback Plan` from a test PR to ensure the workflow fails cleanly and exits with a non-zero status code (e.g., `process.exit(1)`).

---

## CI/CD Guide

### How the Action Works
When a PR is `opened`, `edited`, or `synchronize` (new commit), the GitHub Action runs the engine. If validation fails, the Action turns red, blocking the merge (if branch protection requires this status check). Once approved and merged, you can configure a separate run that actually appends the Google Doc (to prevent spamming docs on non-merged PRs).

### Debugging CI Failures
1. Enable step-debug logging in GitHub by setting a repository secret `ACTIONS_STEP_DEBUG` to `true`.
2. Review the Action logs. If it's a validation error, the engineer needs to fix their PR description. If it's an infrastructure error, inspect the stack trace for API rejections.

---

## Deployment Guide

This is strictly a continuous integration tool. "Deployment" means enabling it on a repository.

1. Configure GitHub Actions Workflow YAML file in `.github/workflows/pr-documentation.yml`.
2. Setup the Organizational or Repository Secrets for `GITHUB_TOKEN` and `GOOGLE_CREDENTIALS_BASE64`.
3. Set up the `GOOGLE_DOC_ID` in the repository variables.

### Credential Rotation
GCP Service Accounts should be rotated every 90 days. Generate a new key, base64 encode it, update the GitHub Secret, then delete the old key in the GCP Console.

---

## Security Considerations

- **Secret Handling**: Base64 JSON decoding limits the risk of multiline formatting issues leaking secrets into logs.
- **Permission Scoping**: The GCP Service account should *only* have permissions to edit the specific Google Docs needed, not organization-wide Drive access.
- **Avoiding Injection**: PR bodies shouldn't be executed. The system treats them securely as pure strings, mitigating arbitrary code execution.

---

## Production Checklist

- [ ] All environment variables are stored in GitHub Secrets (not Variables).
- [ ] PR branch protection is configured to require this Job's successful run.
- [ ] A dedicated Service Account is provisioned (do not use personal accounts).
- [ ] `.gitignore` contains `.env`, `*.json` (for artifacts), and `node_modules/`.
- [ ] OIDC (Workload Identity Federation) has been evaluated as a safer alternative to static JSON keys for GCP.

---

## Operational Checklist

- **Monitoring**: Since this is a CI pipeline, monitor the success/failure rate of the GitHub Action overall. 
- **Logs**: Do not log raw PR bodies if they contain sensitive data. Log PR Numbers, Author Handles, and Validation rule failures.
- **Alerting**: Alert the DevOps team via Slack if the pipeline fails with HTTP 500s or Authentication Errors. Validation errors should just ping the PR Author.

---

## Common Failure Modes

1. **`TypeError: Cannot read properties of null`** -> The PR Body missing, bypassed by validating against `pr.body || ""`.
2. **`429 Too Many Requests` (GitHub)** -> Action ran on a monorepo with 50 PRs simultaneously. Implement Backoff strategies.
3. **`403 Forbidden` (Google Docs)** -> The master Google Doc was deleted or its permissions were changed, stripping the Service Account of its write access.
4. **Duplicate Entries in G-Docs** -> Action is run on `pull_request: synchronize`. Ensure the append action is *only* triggered on `pull_request: closed` and `if: github.event.pull_request.merged == true` in your workflow YAML.

---

## Extension Roadmap

- **Idempotency Updates**: Instead of blindly appending, use document search to find historical entries and overwrite them.
- **AI Enhancement**: Add `OpenAIClient` to automatically generate the `## Summary` if it's missing or poor quality.
- **Metrics Dashboard**: Centralize the generated JSON artifacts into a Postgres DB to build metrics on PR quality over time.
