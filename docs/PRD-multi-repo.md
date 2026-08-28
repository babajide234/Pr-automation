# PRD: Plug-into-any-repo documentation engine

| Field | Value |
|---|---|
| Status | Draft v2 (merged) |
| Date | 2026-08-26 |
| Product | pr-doc-engine |
| Author | Engineering |
| Related | README, `.env.example`, `.github/workflows/pr-doc.yml`, `src/config/env.ts`, `src/config/constants.ts` |

### Changes from draft v1

| § | Change |
|---|---|
| 5.4 | **New.** Config is read from the base ref on `pull_request` events. Fork PRs cannot alter policy in the PR that carries the change. |
| 5.5 | **New.** Credentials resolved through a provider interface rather than read directly from `process.env`. |
| 7 | Section `required` replaced by `severity: error \| warn \| off`. Adds `validation.exempt` and `extends`. |
| 7.1 | Placeholder matching scoped to extracted section bodies, fenced code blocks skipped, case sensitivity configurable. |
| 9 | Validate phase distinguishes blocking failures from warnings. |
| 12 | Success criteria extended to cover fork safety and bot exemptions. |

---

## 1. Summary

pr-doc-engine should be a reusable GitHub Action that any repository can adopt to improve PR documentation: a matching pull-request template, fail-fast validation while the author is still writing, and optional archival on merge.

Today it cannot do that. Repo identity, destination IDs, and documentation policy are all treated as environment variables. Required headings are hardcoded in two places. The workflow assumes *this* repository is the engine (`npm install` / `node dist/index.js`). The PR template does not match the validator, so a PR that follows the repo's own template fails the gate.

This PRD defines the product contract: **secrets stay secrets, runtime context comes from GitHub (or CLI flags), and per-repo policy lives in a committed `.pr-doc.yml` read from the base branch.** Template, validation, normalization, and archival share one schema.

No implementation is implied by this document. It is the spec for that work.

---

## 2. Problem

### 2.1 Env is used for things that are not secrets

Current required environment variables (`src/config/env.ts`):

| Variable | Used in | Actual nature |
|---|---|---|
| `GITHUB_TOKEN` | `GithubClient` | Secret — keep as env / Actions secret |
| `GOOGLE_SERVICE_ACCOUNT` | `GoogleDocsClient` | Secret — keep as env / Actions secret |
| `GITHUB_REPO_OWNER` | `GithubClient` | Runtime context GitHub Actions already injects |
| `GITHUB_REPO_NAME` | `GithubClient` | Runtime context GitHub Actions already injects |
| `PR_NUMBER` | `GithubClient` | Runtime context GitHub Actions already injects |
| `GOOGLE_DOC_ID` | `GoogleDocsClient` | Per-repo destination, not a secret |

A consuming repo cannot "just plug this in." It must invent env values for identity that CI already knows, and it must store a Google Doc ID in secrets even though the ID is not confidential.

### 2.2 Documentation policy is hardcoded and duplicated

Required headings live in two places and are not configurable:

- `src/domain/services/validation.service.ts` (`## Summary`, `## Technical Design`, `## Rollback Plan`)
- `src/config/constants.ts` (`REQUIRED_PR_SECTIONS`, same list)

Placeholder rejection (`TBD`) is also hardcoded. Every consuming team would have to fork the engine to change their documentation standard.

### 2.3 Template, validator, and normalizer disagree

`.github/pull_request_template.md` asks authors for headings such as `## 📝 Release Notes Description` and `## 🚨 Risk Analysis & Rollback Plan`.

The validator and `NormalizationService` expect `## Summary`, `## Technical Design`, and `## Rollback Plan`. A PR that follows the template fails the gate. That is the opposite of improving the documentation process, and it is a live defect in this repository independent of portability.

`NormalizationService` also extracts sections that neither the template nor the validator mention (`## Database Changes`, `## API Changes`, `## Deployment Notes`).

### 2.4 The workflow is not reusable

`.github/workflows/pr-doc.yml` checks out *this* repo, installs its dependencies, and runs `node dist/index.js`. That model only works when the engine *is* the consumer. Other repositories would have to copy source, clone this project as a submodule, or keep a private fork. No configuration design fixes this; it is a packaging problem and it is the primary blocker.

It also only runs on `pull_request` `closed` when `merged == true`. Authors get no feedback while they are writing the description.

### 2.5 README and code already disagree on env names

| README | Code |
|---|---|
| `GITHUB_REPOSITORY` | `GITHUB_REPO_OWNER` + `GITHUB_REPO_NAME` |
| `GOOGLE_CREDENTIALS_BASE64` | `GOOGLE_SERVICE_ACCOUNT` (raw JSON string) |

That drift is evidence the env surface is already the wrong source of truth.

### 2.6 Committed policy is untrusted input from a fork

This problem does not exist today, because policy is not committed. Moving policy into the repository creates it, and it must be designed for rather than discovered later. On `pull_request` events, the head branch is attacker-controlled. A fork PR that edits `.pr-doc.yml` in its own head can set every section to `off`, empty `reject_placeholders`, or repoint `document_id` at a document the attacker controls — in the same PR that carries the change. See §5.4.

---

## 3. Goals and non-goals

### 3.1 Goals

1. Any repository can adopt the engine with a short workflow file and a committed config file.
2. Secrets, runtime context, and repo policy are never mixed.
3. Default config is enough to start: empty or omitted `.pr-doc.yml` uses engine defaults.
4. One schema drives the PR template, validation, normalization, and archival body.
5. Authors get readable feedback on open/edit/sync, not only a red job on merge.
6. Google Docs is optional. A repo can use this as a documentation-quality gate without GCP.
7. Local CLI still works, without requiring `GITHUB_REPO_*` or `PR_NUMBER` in `.env`.
8. Policy changes are reviewable: a PR cannot weaken the standard it is being judged against.
9. A team can adopt without breaking every open PR on day one.

### 3.2 Non-goals (later work)

- AI-generated summaries or auto-fill of missing sections
- Postgres / metrics dashboard of PR quality
- Notion or other archival destinations beyond Google Docs + JSON
- Idempotent Google Docs updates (search-and-replace historical entries)
- OIDC / Workload Identity Federation for GCP — the provider interface in §5.5 is in scope; the OIDC provider itself is not
- Changing GitHub PR title conventions beyond what the template already documents

---

## 4. Users and jobs to be done

| User | Job |
|---|---|
| Consuming-repo owner | Add the Action, commit `.pr-doc.yml` (or rely on defaults), optionally enable Google Docs |
| PR author | Fill the template; get a comment listing missing or placeholder sections; merge when green |
| Reviewer | Trust that required operational sections exist before approve/merge |
| Platform / DevEx engineer | Define one standard once and have repositories inherit it |
| Engine maintainer | Ship this repo as the Action source; version it; keep defaults and schema in one place |
| Local developer | Run validation against a real PR without stuffing repo identity into `.env` |

---

## 5. Config taxonomy (core product rule)

Every setting belongs in exactly one bucket. Implementers must not add a new env var for policy or identity.

### 5.1 Secrets (env / Actions secrets only)

| Name | Required when | Notes |
|---|---|---|
| `GITHUB_TOKEN` | Always in CI | In GitHub Actions, use the automatically provided `GITHUB_TOKEN`. Locally: `GITHUB_TOKEN` or `gh auth token`. |
| `GOOGLE_SERVICE_ACCOUNT` | Only if `destinations.google_docs.enabled` is true | Service account JSON. Not committed. Org- or repo-level secret. |

No other secrets are required for v1.

### 5.2 Runtime context (GitHub event or CLI flags, never committed)

| Field | CI source | Local source |
|---|---|---|
| Owner | `github.repository_owner` / `github.repository` | `git remote` or `--repo owner/name` |
| Repo name | `github.event.repository.name` | same |
| PR number | `github.event.pull_request.number` | `--pr <n>` |
| Event / mode | `github.event_name` + `github.event.action` + `merged` | `--mode validate` or `--mode archive` |
| Base ref | `github.event.pull_request.base.sha` | `git merge-base` or `--base <ref>` |

These must not appear in `.pr-doc.yml` or in consuming-repo secrets.

### 5.3 Repo policy (committed `.pr-doc.yml`)

- Required vs optional sections, their headings, and their severity
- `extract_as` keys for normalization
- Placeholder denylist and match scope
- Empty-section behavior
- Exemptions (labels, authors, draft state)
- Destination toggles and `document_id` for Google Docs
- When to validate vs when to archive

Path default: `.pr-doc.yml` at the repository root. Override via Action input `config-path`.

### 5.4 Config resolution and fork safety

**On `pull_request` events, config is read from the base ref, never from the PR head.** The engine fetches `.pr-doc.yml` at `github.event.pull_request.base.sha` via the GitHub contents API, not from the checked-out working tree.

Consequences, all intended:

- A fork PR cannot weaken the standard it is being judged against.
- A PR that legitimately changes `.pr-doc.yml` is judged against the *old* policy. That is correct: the new policy takes effect once reviewed and merged.
- The head-branch config is still parsed and schema-checked, and any error or diff is reported in the validation comment as advisory. An author changing policy gets told whether their new file is valid, without it taking effect.

On `push`, `workflow_dispatch`, and local CLI runs, config is read from the working tree. There is no untrusted head in those cases.

If the base ref has no `.pr-doc.yml`, engine defaults apply — the same as a repo that has never configured anything.

### 5.5 Credential resolution

Credentials are obtained through a resolver interface rather than read directly from `process.env` at the point of use. v1 ships a single `env` provider; the interface exists so that OIDC / Workload Identity Federation is a provider addition rather than a rewrite of the Google Docs client.

Requirements:

- No credential value is ever read from `.pr-doc.yml`. If a value in the config file matches a credential shape (a PEM block, a JSON object containing `private_key`, a `ghp_`/`github_pat_` prefix), the run fails with a configuration error naming the key. A committed key is a disclosed key; this is a hard failure, not a warning.
- A destination resolves only its own credential. A repo running validate-only never resolves a Google credential.
- No credential value appears in logs, error messages, PR comments, or JSON artifacts.

---

## 6. Packaging: reusable GitHub Action

This repository becomes the Action source. Consuming repositories do not copy `src/` and do not run `npm install` of the engine's tree.

### 6.1 Consumer workflow (target UX)

```yaml
# .github/workflows/pr-doc.yml in ANY repo
name: PR Documentation

on:
  pull_request:
    types: [opened, edited, synchronize, closed]

permissions:
  contents: read
  pull-requests: write   # for validation comments

jobs:
  pr-doc:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: <this-org>/pr-doc-engine@v1
        with:
          google-credentials: ${{ secrets.GOOGLE_SERVICE_ACCOUNT }}
          config-path: .pr-doc.yml
```

`google-credentials` is ignored when Google Docs is disabled. `config-path` defaults to `.pr-doc.yml`.

The Action reads owner, repo, PR number, event, and base ref from the GitHub context. Consumers never set `GITHUB_REPO_OWNER`, `GITHUB_REPO_NAME`, `PR_NUMBER`, or `GOOGLE_DOC_ID` as secrets.

Note on `pull_request` vs `pull_request_target`: this design deliberately stays on `pull_request`. Fork safety comes from reading config at the base SHA (§5.4), not from elevating the workflow's token. `pull_request_target` would grant fork PRs a write-scoped token in the base context and is out of scope.

### 6.2 This repo's role

- Publish `action.yml` wrapping the existing Node engine.
- Version releases (`v1`, `v1.x.x`) so consumers can pin.
- Ship a default PR template that matches the default schema (§8).
- Publish the JSON Schema for `.pr-doc.yml` so editors can autocomplete and lint it.
- Keep a dogfood workflow that uses the Action against this repo itself.

### 6.3 Local CLI

```bash
npx pr-doc-engine validate --pr 123
npx pr-doc-engine archive --pr 123
npx pr-doc-engine config print      # resolved config, provenance per key, secrets redacted
```

- Token: `GITHUB_TOKEN` or `gh auth token`
- Owner/repo: `git remote` or `--repo owner/name`
- Policy: `.pr-doc.yml` (or `--config`)
- `--pr` is required locally; there is no `PR_NUMBER` env requirement

`.env` may still hold `GITHUB_TOKEN` and `GOOGLE_SERVICE_ACCOUNT` for local runs. It must not be required for owner, repo, PR number, headings, or document ID.

---

## 7. `.pr-doc.yml` schema (v1)

If the file is missing, empty, or omits a key, the engine applies the defaults below. A repo can start with no file.

```yaml
version: 1
extends: ""                       # optional: "@my-org/pr-doc-standard" or a pinned git ref

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
  placeholder_scope: required_sections    # required_sections | all_sections | body
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

### 7.1 Field rules

| Field | Rules |
|---|---|
| `version` | Required if the file exists. v1 only for this spec. Unknown version fails with a clear error. |
| `extends` | Optional. Resolves a base config from an npm package or pinned git ref, merged beneath the local file. Arrays replace, they do not append (see §15.4). Resolution failure is a hard error, not a silent fallback to defaults. |
| `sections[].heading` | Markdown `##` heading string matched in the PR body. Unique within the file. |
| `sections[].severity` | `error` blocks the merge. `warn` reports in the comment, exit code unaffected. `off` extracts if present, never reports. Default `error`. |
| `sections[].required` | Deprecated alias. `true` → `severity: error`, `false` → `severity: off`. Accepted in v1 with a warning; removed in v2. |
| `sections[].extract_as` | Stable key used in the JSON artifact and archival body. Unique. Default schema uses camelCase to match today's `PRDocumentation` fields. |
| `validation.reject_placeholders` | Token list. Empty list disables the check. |
| `validation.placeholder_case_sensitive` | Default `false`. Resolves the lowercase-`tbd` question left open in the current testing guide. |
| `validation.placeholder_scope` | Default `required_sections`. Fenced code blocks and HTML comments are excluded from matching at every scope. Matching is on word boundaries, not bare substring, so `TODO` in `TODOMVC` or a linked URL does not fire. |
| `validation.fail_on_empty_required` | If true, a heading whose body is only whitespace, HTML comments, or unticked template checklist lines fails. |
| `validation.exempt.labels` | PRs carrying any listed label skip validation entirely. |
| `validation.exempt.authors` | PRs opened by any listed login skip validation. Intended for bots. |
| `validation.exempt.draft` | If true, draft PRs skip validation. They are re-validated on `ready_for_review`. |
| `destinations.google_docs.enabled` | If true, `document_id` is required and the Google credential must resolve. If false, skip Google Docs even if the secret exists. |
| `destinations.json_artifact.enabled` | If true, write `pr-<number>.json`. |
| `triggers.validate_on` | GitHub `pull_request` activity types that run validation. |
| `triggers.archive_on` | `merge` means `closed` + `merged == true` only. |

### 7.2 Why severity, not a boolean

A team adopting this on an existing repository with twenty open PRs will fail every one of them on the first run. Severity is the rollout mechanism: start new sections at `warn`, watch the comments, promote to `error` when the team has caught up. Without it, adoption means a flag day, and flag days mean the Action gets removed instead.

### 7.3 Why exemptions are not optional

Dependabot and Renovate open PRs with generated bodies containing no `## Rollback Plan`, on a schedule, forever. Without `exempt.authors`, a repo's CI is permanently red within a week of adoption and the gate is disabled. This is the most likely single cause of failed adoption and it is cheap to prevent.

### 7.4 Default headings are the product default

The three headings above are both:

1. The engine's built-in default when no config is present
2. The headings in the shipped default PR template

Teams that want the richer template currently in this repo (Release Notes, Frontend Changes, etc.) map those headings in *their* `.pr-doc.yml`. The engine does not special-case them.

### 7.5 Google Docs is optional

A repository with no GCP setup still gets the default template, validation on PR open/edit/sync, and a JSON artifact on merge. That is enough to improve the documentation process. Archival to Google Docs is an add-on, not a prerequisite.

---

## 8. Single source of truth for the documentation process

One resolved config (or the built-in default) drives four surfaces. They must not have independent heading lists.

```text
.pr-doc.yml @ base ref  (or engine defaults, or extends base)
        │
        ├── PR template (generated or shipped default matching schema)
        ├── ValidationService (headings, severity, placeholders, empty sections)
        ├── NormalizationService / ParsingService (extract_as keys)
        └── Archival body (same keys, same order)
```

### 8.1 Template

- Ship a default `.github/pull_request_template.md` whose `##` headings equal the default schema.
- Provide a generate path so a consumer can emit a template from *their* `.pr-doc.yml`.
- Template HTML comments are allowed as author guidance; they must not count as section content when `fail_on_empty_required` is true.

### 8.2 Validation

Order of operations:

1. Resolve config from base ref (§5.4).
2. Check exemptions. If exempt, exit 0 with a one-line comment stating which rule exempted the PR.
3. For each section with severity `error` or `warn`: heading must appear; if `fail_on_empty_required`, its body must be non-empty after stripping comments, checklists, and whitespace.
4. Apply `reject_placeholders` within `placeholder_scope`.
5. Exit non-zero only if at least one `error`-severity finding exists.

Delete the duplicate list in `constants.ts`. Policy comes from the resolved config; the engine's built-in default is the only hardcoded list and it lives in one file.

### 8.3 Normalization and archival

`PRDocumentation` is keyed by `extract_as` plus always-present metadata: `prNumber`, `title`, `author`, `mergedAt`.

The Google Docs / JSON payload derives from that model. Adding a section in config is enough to extract, validate, and archive it. No code change per heading.

### 8.4 Author-facing errors

Validation failures must not be a stack trace.

On validate runs, the Action posts or updates **one** comment per PR (find-and-update by a hidden marker, never append) listing:

- Missing headings, grouped by severity, blocking ones first
- Empty required sections
- Placeholder hits, with the matched token and the section it was found in
- Advisory notes on head-branch config changes (§5.4)

The job exits non-zero on `error`-severity findings so branch protection can block merge. `warn` findings appear in the comment under a separate heading and do not affect the exit code.

The comment is the author UX. It is not a publishing destination and does not go through the destinations layer.

---

## 9. Two-phase CI

| Phase | When | What runs | What must not run |
|---|---|---|---|
| Validate | `pull_request` types in `triggers.validate_on` | Resolve config at base ref, check exemptions, validate, comment | Google Docs append, JSON archive |
| Archive | `pull_request` closed and `merged == true` | Resolve config at the merge commit, validate again, then destinations | Nothing if validation fails at `error` severity |

If a merged PR fails validation, archival is skipped and the job fails. That is intentional: merge-time is a backstop, not a reason to publish incomplete docs.

Unmerged close (`closed` + `merged == false`) is a no-op. Exempt PRs skip both phases.

This removes the duplicate Google Doc appends the current merge-only design was working around.

---

## 10. Target architecture

```text
                 [ Consuming repo ]
                 .pr-doc.yml  (read at BASE ref)
                 .github/workflows/pr-doc.yml
                          │
                          ▼
              uses: pr-doc-engine@v1
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

Layering stays the same; the domain still has no I/O. Two things change: configuration is loaded by a loader in infrastructure and passed *into* the domain as data, and credentials come from a resolver rather than `process.env` reads scattered through clients.

---

## 11. Migration from today's env

| Today | After |
|---|---|
| `GITHUB_TOKEN` | Unchanged (secret) |
| `GOOGLE_SERVICE_ACCOUNT` | Unchanged (secret); only required if Google Docs is enabled |
| `GITHUB_REPO_OWNER` | Removed. CI context or `git remote` / `--repo` |
| `GITHUB_REPO_NAME` | Removed. Same |
| `PR_NUMBER` | Removed. CI context or `--pr` |
| `GOOGLE_DOC_ID` | `.pr-doc.yml` → `destinations.google_docs.document_id` |
| `REQUIRED_PR_SECTIONS` / hardcoded validator list | `.pr-doc.yml` → `sections` (or engine defaults) |
| `TBD` check | `.pr-doc.yml` → `validation.reject_placeholders` |
| README `GITHUB_REPOSITORY` | Never existed in code; do not carry forward |
| README `GOOGLE_CREDENTIALS_BASE64` | Not used by code today. Out of scope unless implementation chooses encoding; if so, document one format only |

`.env.example` after migration:

```dotenv
GITHUB_TOKEN=
GOOGLE_SERVICE_ACCOUNT=
```

`GOOGLE_SERVICE_ACCOUNT` is optional for validate-only local runs.

Three tasks in this repo are prerequisites, not follow-ups:

1. Rewrite the dogfood workflow to call the Action and stop injecting owner/repo/PR/doc-id as env.
2. Reconcile `.github/pull_request_template.md` with the default schema (§2.3). Either replace the emoji template with the default three headings, or ship a `.pr-doc.yml` that maps the emoji headings. Do not leave both.
3. Correct the README's env names, or delete the Environment Configuration section outright once the config file lands.

---

## 12. Success criteria

A second, unrelated repository can:

1. Add the reusable Action and optionally commit a default or empty `.pr-doc.yml`.
2. Open a PR using the generated or shipped-default template.
3. Fail CI with a readable PR comment listing missing or empty sections if the body is incomplete.
4. Pass CI when required sections are filled and placeholders are gone.
5. On merge, write a JSON artifact; write to Google Docs only if enabled and credentials resolve.

That consuming repo's secrets contain **none** of: `GITHUB_REPO_OWNER`, `GITHUB_REPO_NAME`, `PR_NUMBER`, `GOOGLE_DOC_ID`.

Additional checks for this engine repo:

- Template headings, default schema headings, and validator required list are the same three strings unless a test repo overrides config.
- Local `validate --pr` works without owner/repo/PR in `.env`.
- Enabling Google Docs without `document_id` or without a resolvable credential fails with a configuration error, not a Google API 404/403 mystery.
- A fork PR that sets every section to `off` in its head branch is still validated against the base policy and still fails.
- A PR authored by an exempt bot login exits 0 without a validation comment beyond the exemption note.
- A section set to `warn` produces a comment entry and exit code 0.
- A `TODO` inside a fenced code block does not trigger a placeholder failure.

---

## 13. Risks and constraints

| Risk | Mitigation |
|---|---|
| Teams copy a custom template and drift from `.pr-doc.yml` | Generate template from schema; document that headings in config are canonical |
| `GITHUB_TOKEN` in Actions cannot comment without `pull-requests: write` | Required permission in the consumer workflow example |
| Google Doc ID committed in yaml is visible | Acceptable: it is not a secret. Access is still gated by the service account ACL |
| Base-ref config confuses authors editing policy | Advisory head-config diff in the validation comment (§5.4); document the behaviour in the README |
| Default three headings are stricter than the current emoji template | Current template becomes an *example* optional schema, not the engine default |
| Action versioning (`@v1` vs SHA) | Document pin-to-major; changelog on schema changes |
| `extends` makes debugging opaque | `config print` with per-key provenance ships in the same release as `extends`, not later |
| Severity levels let a team set everything to `warn` and gain nothing | Acceptable. A soft gate someone reads beats a hard gate someone disables |

---

## 14. Later work (explicitly out of this PRD)

- Idempotent Google Docs updates (find previous PR heading, replace instead of insert at index 1)
- Additional destinations (Notion, Confluence)
- AI fill-in for missing summaries
- Metrics warehouse of JSON artifacts
- OIDC credential provider (interface is in scope; provider is not)
- Org-level allowlist of permitted `document_id` values, enforced above repo config
- Custom rule plugins loaded by module path
- Richer empty-section heuristics (minimum word count, checklist-completion checks)

---

## 15. Open questions for implementation (not blockers for this spec)

1. **Action distribution.** JavaScript Action with compiled `dist/` vs composite Action running `npx`. Either satisfies §6 as long as consumers use `uses: <org>/pr-doc-engine@v1`.
2. **JSON artifact path** in Actions: workspace file vs `actions/upload-artifact`. Default can stay a workspace file.
3. **Template emission**: separate `template` command or a flag. Required capability is "emit a template from the schema."
4. **`extends` array semantics.** This spec says replace, which is predictable. Append would let an org add sections a repo cannot remove — better for a compliance posture, worse for local autonomy. Decide before `extends` ships; changing it later is breaking.
5. **Preset distribution** for `extends`: npm package, git ref, or both. Affects whether non-Node repositories can inherit a standard cleanly.
6. **Base-ref fetch cost.** One extra contents-API call per run. Negligible, but confirm behaviour when the base ref is unreachable (deleted branch, force-push): fail closed on engine defaults, or fail the run?