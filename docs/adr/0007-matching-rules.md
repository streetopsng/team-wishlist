# ADR 0007: Matching — host-only grouping, 2+ wishes, leftovers auto-promote

- Status: Accepted
- Date: 2026-09-22

## Context

Matching is the facilitation heart: the host reads the anonymous wish wall and groups wishes
that "ask for the same thing" into a named **collective wish**. The prototype allows selecting
any number of wishes (Match is disabled below 2) and requires a title. Open questions: who
matches, minimum group size, and what happens to unmatched leftovers.

## Decision

- **Host-only** matching — participants see the pool collapse but never select.
- A collective wish takes **2 or more wishes**; singles stay in the pool until phase end.
- A wish can belong to **exactly one** collective wish (selected wishes leave the pool
  immediately; they cannot be re-matched).
- At transition to PRIORITISATION, every remaining ungrouped wish **auto-promotes into its own
  single-wish collective wish**, titled with its original text (exactly as the prototype does).
- No renaming or dissolving after save in v1 (see ADR 0012).

## Consequences

- The facilitator's judgment is trusted; the tool does not suggest clusters (a possible v2:
  embedding-based similarity hints).
- Data model: collective membership is a `collectiveId` on each wish (single source of truth),
  not an array on the collective — makes the exactly-one rule enforceable.
- The host must finish matching before starting prioritisation; there is no "skip" — auto-
  promote means zero unmatched wishes is guaranteed at phase end.
