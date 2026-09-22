# ADR 0001: Team Wishlist is a live, host-facilitated ceremony

- Status: Accepted
- Date: 2026-09-22

## Context

The prototype is ambiguous: it mentions "24 people will be invited by email the moment you
launch" (an async-survey smell) while also showing ready-counters, a lobby with an orbiting
avatar animation, and a dramatic bottom-up results reveal (a live-ceremony smell). These imply
completely different products.

## Decision

Team Wishlist v1 is a **live session**: participants join at the same time (workshop,
all-hands, team offsite), the host drives every phase transition manually in real time, and
ready-counters / reveal ceremony reflect genuine real-time state.

Invites in v1 are a shareable link the host distributes through their own channel (chat,
projector, email by hand). The app itself never sends email (see ADR 0012).

## Consequences

- Real-time sync is a hard requirement, which drives the backend choice (ADR 0004).
- Presence ("who is in the room") is a first-class concept; we need connect/disconnect
  handling (RTDB `onDisconnect`).
- No scheduling, reminders, or deadline logic is needed in v1.
- The email-invite copy in the prototype's setup screen is demoted to an explanatory note.
