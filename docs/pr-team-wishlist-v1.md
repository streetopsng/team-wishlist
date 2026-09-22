# PR: Build Team Wishlist v1 — live anonymous wishlist ceremony on Firebase RTDB

**Branch:** `feature/team-wishlist-v1` → `main` (3 commits, 46 files, +5777/−432)
**Commits:** `5417c15` v1 feature · `ce53911` rules P0 fixes · `9a7eec6` ceremony fix + deploy config

## Summary

Implements Team Wishlist v1 in full: a live, host-facilitated team ceremony where participants anonymously wish for workplace improvements, the host groups wishes into collective wishes, everyone spends 3 priority tokens, and results are revealed bottom-up in a shared moment. Design decisions are recorded as ADRs in `docs/adr/` (12 ADRs + glossary, produced in a design-grilling session before implementation).

## The ceremony (ADR 0011)

`SETUP → WISHING → WAITING → REVEAL → MATCHING → PRIORITISATION → RESULTS → COMPLETE`

- **Host** runs everything from a secret control link `/host/{code}?key=…` (one-time shown, bookmarkable, 128-bit key — ADR 0010). Force-advance is always allowed; live counters inform it.
- **Participants** join anonymously at `/s/{code}` by claiming one of **30 unique avatars** (transactional claim, room cap = roster size — ADR 0003/0005). No names, no accounts, ever. Refresh-proof identity via localStorage.
- **Wishing**: 1–5 wishes per person, 90 chars each, immutable after submit (ADR 0006).
- **Matching**: host-only grouping of 2+ wishes into named collective wishes; leftovers auto-promote to single-wish cards at transition — and the promotion write happens *before* the phase write, so the board can never be observed half-migrated (ADR 0007).
- **Prioritisation**: 3 stackable tokens per person, private until reveal (ADR 0008).
- **Results**: deterministic ranking (points → createdAt → id tie-breaks), host reveals bottom-up, **participants watch #1 land and dismiss it themselves** (`doneResults`) before seeing the finale (ADR 0009).

## Architecture

- **Backend**: Firebase Realtime Database (europe-west1), one subtree per session. Presence via `onDisconnect`; all writes flow through `src/lib/session.ts`. Security rules in `database.rules.json` (see below).
- **Domain core**: `src/lib/domain.ts` is pure and deterministic (phases, limits, scoring, auto-promotion, reveal semantics) — fully unit-tested, zero Firebase imports.
- **Hydration layer**: RTDB values lack their keys and drop empty objects; `hydrate*` functions restore complete domain types on read (a real bug class caught live and now test-locked).
- **UI**: React 19 + the prototype's design system (Baloo 2/Poppins, bracket frames, idea wall, live rankings sidebar), ported from `docs/design/team-wishlist.html`.

## Security rules — fixed and contract-tested, deployment pending

Code review caught P0s that would have shipped a leaked host credential and dead phases:

- `meta.hostKey` was **world-readable** (a child `.read: false` cannot revoke a cascading session-level read). The key now lives at top-level `hostKeys/{code}` — write-once, never readable — and `createSession` no longer writes it into the session record (verified against the live DB after the smoke test caught the first fix attempt missing this).
- Host-gated writes (`meta`, `collectives`, wish `collectiveId` updates, `reveal/index`) validate against an ephemeral top-level `claims/{code}` node that the client clears in `finally` — no standing skeleton key for the room.
- `reveal/index` and `avatars` had **no write rules** (RESULTS and joining would have failed under deployed rules). Wishes now allow claim-gated updates that pin `text/authorPid/avatarId/createdAt` immutable and leave only `collectiveId` mutable — without this, matching and auto-promotion are rejected.

`src/lib/rules.test.ts` locks these invariants as a 7-assertion contract test on the rules JSON, plus a source-level guard that `createSession` never writes a `hostKey` field.

> ⚠️ **Rules are NOT yet deployed.** `firebase.json` + `.firebaserc` are wired so `firebase deploy --only database` works out of the box, but deployment requires project auth. Until then the live DB still runs console rules and `hostKeys/{code}` remains anonymously readable. **Merging can proceed; running a real ceremony must wait for the deploy**, followed by two checks: anonymous `GET hostKeys/{code}.json` → `null`, and deleting the four old test sessions (`UFS6HC`, `MGDCW8`, `VD5RJT`, `VT2SX9`) that still contain keys in `meta`.

## Workflow compliance (AGENT.MD)

1. Branch per feature: ✅ `feature/team-wishlist-v1`
2. Tests before features: ✅ 36 unit tests (phase machine, wish rules, stackable tokens, scoring + tie determinism, auto-promotion, room capacity, hydration, rules contract). The rules rework and the reveal-ceremony fix were both written test-first.
3. Review before push: ✅ full self-review found the P0 rules flaws, the reveal auto-skip bug, and the P1/P2 batch — all fixed on this branch with commits telling the story.
4. Lint + build before push: ✅ at HEAD `9a7eec6`: oxlint 0 warnings / 0 errors, `tsc -b` clean, vite build clean, 36/36 green.

## Verification

- **Unit**: `npx vitest run` → 4 files, 36 tests, green.
- **Static**: `npm run lint` (0/0), `npm run build` (tsc + vite, clean).
- **Live**: end-to-end two-browser-tab ceremony against production RTDB — join → wish → close → reveal → match → auto-promote → 3 stackable tokens → bottom-up reveal with participant acknowledgement → finale — exercising both the explicit-matching path and the auto-promotion path, re-run after each fix.

## Deliberately out of scope (ADR 0012)

No email sending, no host accounts, no CSV export (queued as the first v1.1 feature), no wish editing, no multi-session management, no i18n. Queued follow-ups: ADR 0013 (no-auth trust model), CI workflow, error boundary with retry UX.
