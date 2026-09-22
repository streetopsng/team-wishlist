# ADR 0008: Prioritisation — 3 stackable tokens, participant-controlled

- Status: Accepted
- Date: 2026-09-22

## Context

After matching, each participant decides "what matters most" by spending priority tokens
across the collective wish cards. Open questions: exact count, whether tokens stack on one
card, and what the participant sees while allocating.

## Decision

- Every participant gets exactly **3 priority tokens**.
- Tokens **stack**: multiple tokens may go on the same collective wish (passionate minority
  beats dispersed majority — a deliberate feature, not a bug).
- Allocation is **self-paced** during the PRIORITISATION phase; the participant sees their own
  dot-meter but **not other people's live placements** (no social proof pressure, no anchoring;
  rankings appear only in RESULTS).
- "I'm done" requires ≥1 token placed; allocation can be adjusted freely until submitted;
  after submission the participant sees the completion screen (no take-backs in v1).

## Consequences

- Max possible points per collective wish = 3 × participant count; totals are small integers,
  easily displayed.
- Storage is one map per participant (`tokens: {cid: n}`) — cheap to read for scoring.
- Not showing live placements is a product stance: privacy of priorities until reveal.
