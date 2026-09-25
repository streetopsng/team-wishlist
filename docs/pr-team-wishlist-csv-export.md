# PR: CSV export of session results (Team Wishlist v1.1)

**Branch:** `feature/csv-export` → `main` (2 commits, 4 files, +224/−12)
**Commits:** `b09343a` v1.1 CSV export · `ebd3623` review fixes

## Summary

Ships the first v1.1 feature queued in the v1 PR: **CSV export of results**, so hosts can
capture the ceremony outcome in a spreadsheet instead of screenshotting. Implements the
"exports first" bet from ADR 0012's Consequences; ADR 0012 item 3 is formally amended in
this branch.

## What's included

- **`src/lib/export.ts`** — RFC 4180 CSV serializer: one row per rank entry with
  `rank, collective_wish, points, wish_count, member_wishes`; hostile text (commas, quotes,
  newlines) escaped correctly; safe download filename (`team-wishlist-{code}-{slug}.csv`).
  Serialization is pure and Firebase-free; the DOM download lives behind a single entry
  point (`exportResults`).
- **Host UI** — **Download CSV** on both the **RESULTS** screen (mid-ceremony, no need to
  end the session) and the **COMPLETE** screen.
- **Ranking semantics unchanged** — rows come straight from `computeRanking` (ADR 0009:
  points → createdAt → id), so the file always matches what's on screen.

## ADR amendment

`docs/adr/0012-v1-scope-fence.md` — item 3 (No CSV export) struck through and amended
2026-09-24; Consequences updated. The other seven fence items remain out of scope.

## Workflow compliance (AGENT.MD)

1. Branch per feature: ✅ `feature/csv-export`
2. Tests before features: ✅ 9 unit tests written first (RFC 4180 escaping, hostile text,
   orphan wishes, empty ranking, filename sanitisation)
3. Review before push: ✅ two-axis code review found 4 issues (export only on COMPLETE,
   unamended ADR, misleading purity claim, middle-man/speculative export) — all fixed in
   `ebd3623`
4. Lint + build before push: ✅ oxlint 0/0, `tsc -b` + vite build clean, 45/45 tests green

## Verification

- **Unit**: `npx vitest run` → 5 files, 45 tests, green
- **Static**: `npm run lint` (0/0), `npm run build` (clean)
- **Not in scope**: CRLF line endings (LF only), session metadata columns inside the file
  (identity lives in the filename), the other seven ADR 0012 fence items
