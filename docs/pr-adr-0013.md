# PR: ADR 0013 — no-auth trust model

**Branch:** `docs/adr-0013` → `feature/csv-export` (2 commits)
**Commits:** `116da27` ADR 0013 · `07bb543` review corrections + ADR 0010 amendment

## Summary

Queued follow-up from the v1 PR: a dedicated ADR stating **what protects the room when
there are no accounts** — the security story previously spread across ADR 0003's abuse
posture, ADR 0010's crown-jewel note, and the v1 rules P0 fixes.

## Contents

- **`docs/adr/0013-no-auth-trust-model.md`** — 7-decision trust model: link-as-invitation
  (roster cap client-side), structural anonymity, host authority via write-once
  `hostKeys/{code}` + ephemeral `claims/{code}`, unowned participant writes with honest
  shape-only enforcement, world-readable sessions, server-side enforcement "where the rules
  cover it", no moderation/recovery in v1.
- **Known rules gaps** documented explicitly: no write ownership (sock-puppet token writes
  within the 0–3-per-card bound), 3-total-tokens client-side only, collective creation
  skips the claim check, no roster-cap enforcement, undeclared fields accepted.
- **`docs/adr/0010-host-control.md`** — Decision 1 amended: hostKey lives at top-level
  `hostKeys/{code}`, superseding the original `sessions/{code}/meta` placement (rules P0 fix).

## Review

Two-axis review found the first draft overclaimed rules enforcement in three places
(ballot-box cap, self-scoped writes, schema incapable of personal data) — all corrected in
`07bb543` against the actual `database.rules.json`.

## Workflow compliance (AGENT.MD)

1. Branch per feature: ✅ 2. Docs-only — no tests required 3. Review: ✅ 4. Lint + build: ✅
