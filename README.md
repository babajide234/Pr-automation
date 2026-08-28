# pr-doc-engine

A reusable GitHub Action that improves pull request documentation: a matching template, fail-fast validation while the author is still writing, and optional archival on merge.

Any repository can adopt it with a short workflow file. Secrets stay secrets, runtime context comes from GitHub (or CLI flags), and per-repo policy lives in a committed `.pr-doc.yml` read from the **base branch**.

## Adopt in another repository

```yaml
# .github/workflows/pr-doc.yml
name: PR Documentation

on:
  pull_request:
    types: [opened, edited, synchronize, closed, ready_for_review]

permissions:
  contents: read
  pull-requests: write   # for validation comments

jobs:
  pr-doc:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: babajide234/Pr-automation@v1
        with:
          google-credentials: ${{ secrets.GOOGLE_SERVICE_ACCOUNT }}
          config-path: .pr-doc.yml
```

`google-credentials` is ignored when Google Docs is disabled (the default). `config-path` defaults to `.pr-doc.yml`.

Do **not** set `GITHUB_REPO_OWNER`, `GITHUB_REPO_NAME`, `PR_NUMBER`, or `GOOGLE_DOC_ID` as secrets. Owner, repo, PR number, and event come from the GitHub context. The Google Doc ID, if used, belongs in `.pr-doc.yml`.

Pin to a major tag (`babajide234/Pr-automation@v1`) once a release exists, or use `@main` until then.

## Configuration

If `.pr-doc.yml` is missing or empty, these defaults apply:

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/babajide234/Pr-automation/main/schema/pr-doc.schema.json
version: 1

sections:
  - heading: "## Summary"
    severity: error
    extract_as: summary
  - heading: "## Technical Design"
    severity: error
    extract_as: technicalDesign
  - heading: "## Rollback Plan"
    severity: error
    extract_as: rollbackPlan

validation:
  reject_placeholders: ["TBD", "TODO"]
  placeholder_case_sensitive: false
  placeholder_scope: required_sections
  fail_on_empty_required: true
  exempt:
    labels: [dependencies, chore]
    authors: ["dependabot[bot]", "renovate[bot]"]
    draft: true

destinations:
  google_docs:
    enabled: false
    document_id: ""
  json_artifact:
    enabled: true

triggers:
  validate_on: [opened, edited, synchronize, ready_for_review]
  archive_on: merge
```

JSON Schema for editors: [`schema/pr-doc.schema.json`](schema/pr-doc.schema.json).

### What goes where

| Bucket | Examples | Source |
|---|---|---|
| Secrets | `GITHUB_TOKEN`, `GOOGLE_SERVICE_ACCOUNT` | Env / Actions secrets |
| Runtime context | owner, repo, PR number, event, base SHA | GitHub event or CLI flags |
| Policy | headings, severity, placeholders, destinations, exemptions | `.pr-doc.yml` |

### Fork safety

On `pull_request` events the engine fetches `.pr-doc.yml` at the **base SHA**, not from the PR head. A fork PR cannot weaken the standard it is being judged against. A PR that changes `.pr-doc.yml` is validated against the old policy; the new file takes effect after it is merged. The head-branch file is still schema-checked and any diff is reported in the validation comment as advisory.

On `push`, `workflow_dispatch`, and local CLI runs, config is read from the working tree.

### Severity and exemptions

- `error` blocks merge (non-zero exit). `warn` is comment-only. `off` extracts if present and never reports.
- Start new sections at `warn` when rolling out on a repo with open PRs, then promote to `error`.
- Dependabot/Renovate and draft PRs are exempt by default so adoption does not turn CI permanently red.

### Google Docs

Google Docs is optional. Enable it in config and store the service-account JSON as `GOOGLE_SERVICE_ACCOUNT`. A missing `document_id` or credential is a configuration error, not a Google API 404.

A richer heading set (the previous emoji template) lives in [`examples/rich-template/`](examples/rich-template/).

## Local CLI

```bash
npm install
npm run build

npx pr-doc-engine validate --pr 123
npx pr-doc-engine archive --pr 123
npx pr-doc-engine config print
npx pr-doc-engine template --out .github/pull_request_template.md
```

- Token: `GITHUB_TOKEN` in `.env`, or `gh auth token`
- Owner/repo: `git remote` or `--repo owner/name`
- Policy: `.pr-doc.yml` or `--config`
- `--pr` is required for `validate` / `archive`

`.env` may hold only:

```dotenv
GITHUB_TOKEN=
GOOGLE_SERVICE_ACCOUNT=
```

`GOOGLE_SERVICE_ACCOUNT` is optional for validate-only runs.

## Architecture

```text
                 [ Consuming repo ]
                 .pr-doc.yml  (read at BASE ref)
                 .github/workflows/pr-doc.yml
                          │
                          ▼
              uses: babajide234/Pr-automation@v1
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ Application: PRDocWorkflow                                  │
│  mode = validate | archive  (from GitHub event / --mode)    │
│  config = ConfigLoader(base sha) → defaults → extends       │
│  creds  = CredentialResolver(provider)                      │
└──────────┬──────────────────┬──────────────────┬────────────┘
           ▼                  ▼                  ▼
   GithubClient         Domain (pure)      Destinations
   token = secret       Validation         JSON (policy)
   owner/repo/PR        Normalization      Google Docs
     = context          Parsing              (policy + secret)
                        rules = data
```

Validate runs on open/edit/sync (and `ready_for_review`). Archive runs only when a PR is closed and merged. Unmerged close is a no-op. If merge-time validation fails at `error` severity, archival is skipped.

## Development

```bash
npm install
npm test
npm run build
npm run bundle   # ncc bundle for the GitHub Action (dist/action)
```

The dogfood workflow in this repo uses `uses: ./`.
