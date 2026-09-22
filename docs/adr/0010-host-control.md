# ADR 0010: Host control via secret link; host force-advances phases

- Status: Accepted
- Date: 2026-09-22

## Context

Two control problems: (a) how the host retains or recovers control of the session — the
prototype's host identity lives only in page state; (b) what happens when the host advances a
phase while participants are still mid-action.

## Decision

1. **Secret host link.** Creating a session generates a 128-bit `hostKey` stored under
   `sessions/{code}/meta`. The host URL is `/host/{code}?key={hostKey}`. Whoever presents the
   key is the host — control is claimable from any device, refresh-proof, and cannot be
   brute-forced in practice. No account, per ADR 0012.
2. **Force-advance.** The host can always move the session forward. A participant who is
   mid-typing when the phase advances simply arrives in the new phase with whatever they had
   submitted; unsubmitted text is lost. Finished participants wait in a lobby state.
3. The host UI always shows live counters (in room, ready, wishes, collectives) so forcing
   ahead is an informed decision, not a blind one.

## Consequences

- The host key is the crown jewel: security rules must make `meta/hostKey` unreadable by
  non-host clients (the host client proves possession by a rule-checkable claim, e.g. writing
  the key into a `hostClaim` node readable only to the rules themselves via `rule.exists()`).
- Force-advance means all phase guards are advisory on the host side (warn but allow) and
  advisory-never on the participant side.
- Losing the host URL after session creation means losing the session (recreate and re-share);
  the UI must show/copy the URL prominently at creation and warn it won't be shown again.
