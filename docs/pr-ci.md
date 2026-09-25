# PR: CI workflow — lint, build, tests on every PR

**Branch:** `chore/ci` → `docs/adr-0013` (1 commit, 1 file, +20)
**Commit:** `7aa5103`

## Summary

Queued follow-up from the v1 PR: **CI workflow** so every PR is verified with the same
gates AGENT.MD rule 4 requires before push.

## Contents

- **`.github/workflows/ci.yml`** — on `pull_request` (all branches) and `push` to `main`:
  1. `npm ci`
  2. `npm run lint` — oxlint, 0 warnings / 0 errors enforced
  3. `npm run build` — `tsc -b` (typecheck) + vite build
  4. `npx vitest run` — full unit suite (49 tests)
- Node 24 on `ubuntu-latest`, npm cache via `setup-node`.

## Notes

- No `engines` field in `package.json` to conflict with; Node 24 matches local dev.
- Merge order: `feature/csv-export` → `docs/adr-0013` → `chore/ci` → `feature/error-boundary`
  (stacked branches; merge commits, not squash).

## Workflow compliance (AGENT.MD)

1. Branch per feature: ✅ 2. CI config — tests exercise existing suite 3. Review: ✅
4. Lint + build: ✅ (49/49 green locally)
