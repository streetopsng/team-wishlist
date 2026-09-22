# ADR 0011: Phases — the authoritative state machine

- Status: Accepted
- Date: 2026-09-22

## Context

The prototype hardcodes a phase ladder in several places (host control map, participant view
switch, host header labels). For the real app the machine must be written once and enforced at
the boundary, not inferred from UI conditionals.

## Decision

The session moves through **8 phases**, all transitions host-driven (ADR 0010), forward-only:

| # | Phase | Participants | Host |
|---|-------|--------------|------|
| 0 | `SETUP` | (not yet joined / lobby) | Configures name & headcount, launches |
| 1 | `WISHING` | Submit 1–5 wishes, then "I'm done" | Watches wall fill, closes |
| 2 | `WAITING` | Lobby ("your wishes are in") | Confirms room is settled |
| 3 | `REVEAL` | See full anonymous wish wall | Sets the scene |
| 4 | `MATCHING` | Watch pool shrink | Groups wishes → collective wishes |
| 5 | `PRIORITISATION` | Spend 3 tokens, then "I'm done" | Monitors progress |
| 6 | `RESULTS` | Watch bottom-up reveal | Clicks "reveal next" |
| 7 | `COMPLETE` | Final ranked list | Wrap-up |

Transition effects (executed atomically with the phase write):

- `SETUP→WISHING`: nothing (participants already joined via link).
- `MATCHING→PRIORITISATION`: auto-promote every ungrouped wish into its own single-wish
  collective wish (ADR 0007).
- `PRIORITISATION→RESULTS`: freeze tokens (writes rejected); ranking is derived on read.

## Consequences

- One canonical `PHASES` array in code, one `meta/phase` string in RTDB; UI renders from it.
- Forward-only: no "back" for the host in v1 — mistakes are papered over by facilitation.
- `WAITING` exists purely as a breath between wishing and reveal; merging it later is easy.
