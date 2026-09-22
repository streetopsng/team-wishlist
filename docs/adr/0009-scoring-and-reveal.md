# ADR 0009: Scoring — tokens are points, ties by creation, bottom-up reveal

- Status: Accepted
- Date: 2026-09-22

## Context

The prototype fabricates scores with random weights — fine for a demo, unacceptable for a real
room that will ask "wait, why did this win?". The reveal order (bottom-up vs top-down) was also
undecided.

## Decision

- **points(collective wish) = total priority tokens placed on it by all participants**
  (1 token = 1 point). No group-size weighting, no randomness.
- **Ties**: earliest-`createdAt` ranks higher (deterministic, stable across clients).
- **Reveal is bottom-up**: the host clicks through last place → first place; the live
  rankings sidebar fills slot N, N−1, … 1. Each click reveals one card; participants see the
  same reveal step at the same moment. Drama is the product.

## Consequences

- Scoring is fully derived client-side from `participants/*/tokens` — no stored aggregate to
  go stale (ADR 0004). All clients compute the same ranking deterministically (same tie rule).
- The reveal cursor is a single integer in `reveal/index`; late joiners to the ceremony see
  the current step, not history replay.
- A zero-token collective wish still appears (last place, 0 pts) — every group gets closure.
