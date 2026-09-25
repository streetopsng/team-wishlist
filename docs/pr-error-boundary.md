# PR: App-level error boundary with retry UX

**Branch:** `feature/error-boundary` → `chore/ci` (2 commits)
**Commits:** `6ba0785` error boundary (test-first) · `f9871d9` review cleanups

## Summary

Queued follow-up from the v1 PR: **error boundary with retry UX** — catches render errors
anywhere under the app root and lets the host or participant recover without a hard reload.

## What's included

- **`src/components/ErrorBoundary.tsx`** — class boundary: friendly fallback ("Something
  went wrong"), raw error message for debugging, **Try again** button that clears the error
  and bumps a `Fragment` key so the failed subtree fully remounts. Logs via
  `componentDidCatch`.
- **`src/main.tsx`** — wraps `<App />` inside `StrictMode`.
- **`src/components/ErrorBoundary.test.tsx`** — 4 tests: healthy children render, fallback +
  retry on error, retry actually recovers a flaky tree, nested-subtree errors caught.
- **`vitest.config.ts`** — include widened to `*.test.{ts,tsx}`; jsdom selected per-file via
  `@vitest-environment` docblock (Vitest 5: `environmentMatchGlobs` is inert — verified).
- **devDeps:** `jsdom`, `@testing-library/react`, `@testing-library/dom`.

## Review

Two-axis review: smells fixed in `f9871d9` — shared `vi.restoreAllMocks()` cleanup instead
of 3× spy boilerplate; dropped the inert `environmentMatchGlobs` duplicate.

## Workflow compliance (AGENT.MD)

1. Branch per feature: ✅ 2. Tests before features: ✅ failing test written first (module
   missing = red), then implementation 3. Review: ✅ 4. Lint + build: ✅
   (49/49 tests, oxlint 0/0, build clean)
