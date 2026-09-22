# ADR 0005: Avatar roster of 30, hard session cap

- Status: Accepted
- Date: 2026-09-22

## Context

The prototype ships **18 avatars** (6 color rows × 3 emojis) but its own copy says "24 people
will be invited". Unique-avatar-per-person is mathematically impossible past 18 — a spec bug
caught during design review. The avatar is also the *only* identity (ADR 0003), so collisions
would break the entire anonymity model, not just cosmetics.

## Decision

1. Grow the roster to **30 unique avatars** (emoji + background-color pairs, keeping the
   six-color palette). 30 covers realistic team/workshop sizes with headroom.
2. **Hard session cap = 30.** The session rejects a join when every avatar is claimed, with a
   "room is full" message.
3. Session creation asks for an expected headcount (informational only, cap is enforced by
   roster size, not by the number typed).
4. The UI presents the roster as the 6-color × 5-emoji grid from the prototype.

## Consequences

- Sessions bigger than 30 need a roster expansion (more emoji rows) — trivial change,
  documented here so nobody treats 30 as load-bearing infrastructure.
- Rules must enforce uniqueness on claim (transaction on `participants` reading `avatarId`),
  per ADR 0003.
- Prototype's `TOTAL_PEOPLE = 24` constant dies; all counters use live participant counts.
