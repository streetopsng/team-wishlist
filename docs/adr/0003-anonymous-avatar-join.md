# ADR 0003: Anonymous join — open link + avatar claim, device-persistent identity

- Status: Accepted
- Date: 2026-09-22

## Context

The design's headline promise is anonymity: "You're joining anonymously. No names. Just your
wishes." Yet the host invites specific people, so there is a tension between openness
(low-friction entry, honest wishes) and control (only invitees get in). Also, the prototype
has no answer for page refreshes — a participant would lose their identity and rejoin as
someone new, corrupting the room.

## Decision

1. **Joining** = open the session link (e.g. `/s/ABC123`) → pick an **unclaimed avatar** from
   the roster (ADR 0005) → in the room. No email, no name, no account, ever.
2. **Avatar uniqueness** is enforced server-side (RTDB transaction that claims the avatar ID);
   a taken avatar cannot be double-claimed, even from two devices simultaneously.
3. **Identity persistence**: the claimed identity (session code + participant ID) is stored in
   `localStorage`. A refresh or accidental tab close transparently rejoins the same avatar.
   Clearing site data means joining fresh — acceptable for v1.
4. **Abuse posture**: v1 accepts that anyone with the link can join. The link is effectively
   the invitation; hosts share it only with the intended room. This is the price of total
   anonymity and zero-friction entry.

## Consequences

- No auth provider, no account recovery, no moderation tooling in v1.
- The avatar **is** the identity; all UI must refer to people by avatar only.
- Roster capacity bounds session size (ADR 0005).
- Persistence creates a subtle edge case: an abandoned participant still counts in "in room"
  until disconnect handling prunes them (presence is online/offline, membership is permanent).
