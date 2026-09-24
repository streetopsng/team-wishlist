# ADR 0013: No-auth trust model — what protects the room when there are no accounts

- Status: Accepted
- Date: 2026-09-24

## Context

v1 ships with no auth provider (ADR 0002, ADR 0003, ADR 0012): participants are anonymous
avatars, the host is a 128-bit key in a URL (ADR 0010). The v1 PR queued a dedicated ADR to
spell out the resulting trust model, because the security story is currently spread across
ADR 0003's abuse posture, ADR 0010's crown-jewel note, and the rules P0 fixes — and because
"no accounts" is often mistaken for "no security". The RTDB security rules
(`database.rules.json`, contract-tested in `src/lib/rules.test.ts`) are the real boundary;
this ADR states what they are defending and what they deliberately do not defend.

## Decision — the trust model

1. **The link is the invitation.** Anyone holding `/s/{code}` may join. The roster cap
   (ADR 0005) bounds the room **client-side only** (`domain.isRoomFull`); the security rules
   do not count participants — see Consequences. We accept link-forwarding and drive-by joins
   as the price of zero-friction, account-free entry (ADR 0003 §4). The room is not a vault;
   it is a facilitated session among people who were handed a link.
2. **Anonymity is structural, not policy.** Identity is an avatar + opaque `pid`
   (ADR 0003). The schema carries no name or email today — though rules validate required
   fields, they do not reject undeclared extras, so "cannot hold personal data" is a
   discipline, not an enforcement (see Consequences).
3. **Host authority = proof of possession of `hostKeys/{code}`.** The key is write-once,
   top-level, never readable — not by participants, not by hosts after creation. This
   placement supersedes ADR 0010 Decision 1's original "stored under `sessions/{code}/meta`"
   (amended there; corrected here per the v1 rules P0 fixes). Every host-gated **update**
   (meta, collectives, wish `collectiveId`, reveal) validates against an ephemeral
   `claims/{code}` node the client writes and clears in `finally`: no standing skeleton key
   exists anywhere in the tree. Collective **creation** currently passes the
   `!data.exists()` create path without a claim check — a known rules gap (Consequences).
4. **Participant writes are unowned; only shapes are enforced.** With no auth there is
   nothing binding a write to a person: any client can create any `$pid`, wish with any
   `authorPid`, and write tokens for any participant — each token value capped 0–3 per
   (`pid`, collective) by rules. The **3-tokens-total-per-participant** invariant (ADR 0008)
   is enforced client-side only (`domain.canAddToken`); rules never sum across collectives.
   Wish fields are immutable after creation (`text/authorPid/avatarId/createdAt` pinned;
   only claim-gated updates may touch `collectiveId`).
5. **Session state is world-readable by design.** `/s/{code}` must render for anonymous
   clients, so the ceremony subtree is openly readable. The only secrets (host key, claim)
   live outside it. Read = knowing the code; write = following the rules above.
6. **Enforcement is server-side where the rules cover it; the client is
   honest-but-untrusted.** All writes flow through `src/lib/session.ts`; the rules re-state
   the invariants they can express (field shapes, pinning, token bounds, claim-gated
   updates), and the gaps they cannot express are listed under Consequences. The domain core
   (`src/lib/domain.ts`) is pure so client and tests reason from the same logic.
7. **No moderation, no revocation, no recovery (v1).** We do not ban, mute, eject, or
   reset. Losing the host URL means losing the session (ADR 0010); an abuser with the link
   is handled socially — stop sharing the link — not technically.

## Consequences

- Residual risks accepted for v1: link leakage lets outsiders observe or join (the roster
  cap is client-side only); a leaked host key is unrecoverable and instantly transferable —
  rotate by creating a new session; the live database must run the deployed rules, not
  console rules, or `hostKeys/{code}` stays anonymously readable (the pending-deploy note in
  the v1 PR).
- **Known rules gaps** (no auth means no ownership; accepted under this model, tracked for
  hardening): participants can be created impersonated and tokens written for any `pid`
  within the 0–3-per-card bound — ballot-stuffing via sock-puppet pids is possible for
  anyone with the link; the 3-total-tokens rule is client-side; collective creation skips
  the claim check; rules do not enforce the roster cap or reject undeclared fields.
- Trust hardening that would require auth (per-participant accountability, host identity
  recovery, moderation) is explicitly v2 territory alongside GummyGum-native identity
  (ADR 0002, ADR 0012).
- Any future feature that wants to store personal data must first amend this ADR: the
  schema carries none today by discipline, not by rule enforcement.
