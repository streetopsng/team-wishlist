# ADR 0002: Standalone v1, shaped for a future GummyGum embedding

- Status: Accepted
- Date: 2026-09-22

## Context

The prototype references "GummyGum" as the surrounding platform (host home lives inside it,
participant lists come from it, invites are emailed by it). GummyGum does not exist in this
repository and cannot be integrated today.

## Decision

Build a **standalone app** for v1: the host creates a session in this app and shares a link.
No GummyGum integration, no external identity, no org chart.

However, the data model stays **GummyGum-shaped** so embedding later is cheap:

- A `session` record carries `invitedCount` and a `source` field (default `"standalone"`).
- Participants are identified by opaque IDs, never by email or name (see ADR 0003), so a
  future GummyGum member ID can be attached without schema surgery.
- All experience constants (wishes per person, token count, roster) live in one config module,
  ready to become per-org settings.

## Consequences

- Faster v1: no integration layer, no auth provider.
- A thin seam to pay for later: session metadata we don't use yet must still be written.
- We do **not** build org/team management now, even though names like "host" hint at it.
