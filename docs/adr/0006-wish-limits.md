# ADR 0006: Wish limits — 1 to 5 wishes, 90 characters, submit is final

- Status: Accepted
- Date: 2026-09-22

## Context

The prototype allows up to 5 wishes per person (90-char textarea), disables "Add wish" at 5,
and disables "I'm done" at 0 — implying ≥1 wish is required. The grill confirmed all three,
and rejected wish editing for v1.

## Decision

- Each participant submits **1 to 5 wishes**; the 6th is refused by UI and by rules.
- Each wish is **1–90 characters**, trimmed; empty submits are refused.
- **Submit is final** — no editing or deleting after submit (see ADR 0012). The prototype's
  confirmation ("Your wish is in.") stays as the only feedback.
- "I'm done" is disabled until ≥1 wish exists; after it, the participant waits in the lobby
  until the host advances the phase (ADR 0011).

## Consequences

- Wishes are short by design — the 90-char cap keeps the idea wall scannable and matching
  fast; anyone needing nuance is directed by facilitation, not by the form.
- Rules must enforce both the count per participant and the length (`.validate()` on write).
