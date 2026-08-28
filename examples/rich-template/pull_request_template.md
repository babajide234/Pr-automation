<!-- 
  PR Title Format: <type>(<scope>): <subject>
  Example: feat(ui): add responsive dashboard grid
           fix(api): resolve user authentication timeout
  Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
-->

## 📝 Release Notes Description
<!-- 
  This section will be automatically extracted for release notes.
  Clear, user-facing description of what this PR does.
  If this is a non-visible technical change, write "Internal engineering improvements".
-->
**User-facing changes:**
- 

## 🎯 Problem Statement & Goal
<!-- Why is this change necessary? What problem does it solve? Provide context. -->
**Context:**
**Issue/Ticket:** [Ticket-ID](link)

## 🤔 Architectural Decisions & Tradeoffs
<!-- 
  Explain the design choices made. 
  Why did you choose this approach over alternatives? 
  Are there any future tech debt implications? 
-->
- **Approach:** 
- **Alternatives Considered:** 
- **Tech Debt Introduced/Removed:** 

## Frontend Changes
<!-- Check all that apply and provide details/media -->
- [ ] **UI Screenshots/Video:** (Attach Before/After media for visual changes)
- [ ] **Responsive Design:** (Verified on Desktop, Tablet, Mobile)
- [ ] **Browser Testing:** (Verified on Chrome, Firefox, Safari, Edge)
- [ ] **Accessibility (a11y):** (Keyboard navigation, ARIA labels, contrast, screen reader)
- [ ] **State & Performance:** (No new render loops, bundle size impact checked)

## Backend & Infrastructure Changes
<!-- Check all that apply and provide details -->
- [ ] **Database Schema Changes:** (Describe migrations, data backfills, indexing, locking implications)
- [ ] **API Contract Changes:** (Changes to REST/GraphQL payload, backward compatibility)
- [ ] **Documentation:** (Swagger/OpenAPI/Postman collections updated)
- [ ] **Security/Privacy:** (Auth/Permissions checks, PII handling, rate limiting)
- [ ] **Dependencies/Config:** (New environment variables, secrets, package updates)

## Risk Analysis & Rollback Plan
<!-- Evaluate the blast radius of this change -->
**Risk Level:** [Low | Medium | High]

**Failure Modes:**
- What happens if this code fails in production? 
- Will it cascade to other services?

**Deployment & Rollback Plan:**
- [ ] Safe to simply revert PR
- [ ] Requires database rollback / manual intervention (Explain below)
- [ ] Protected by Feature Flag (Flag Name: `___`)
- **Rollback Steps:** 

## Testing & Verification
<!-- How was this completely verified to not break production? -->
- [ ] **Unit Tests:** (Added/updated and passed)
- [ ] **Integration/E2E Tests:** (Added/updated and passed)
- [ ] **Manual Testing:** (Provide the exact steps to reproduce the verification)
- [ ] **Performance Testing:** (Load testing, database query execution plans, lighthouse score)

## Pre-Merge Checklist
<!-- Reviewers should not approve if these are unchecked -->
- [ ] Code follows engineering standards and style guidelines
- [ ] Self-reviewed my own code before requesting review
- [ ] CI/CD pipelines all pass green
- [ ] Telemetry/Observability added (Logs, Metrics, Tracing updated)
