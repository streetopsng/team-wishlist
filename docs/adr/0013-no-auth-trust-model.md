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

1. **The link is the invitation.** Anyone holding `/s/{code}` may join, up to the roster cap
   (ADR 0005). We accept link-forwarding and drive-by joins as the price of zero-friction,
   account-free entry (ADR 0003 §4). The room is not a vault; it is a facilitated session
   among people who were handed a link.
2. **Anonymity is structural, not policy.** Identity is an avatar + opaque `pid`
   (ADR 0003). Nothing in the schema can carry a name or email, so there is no identity data
   to leak — a future GummyGum member ID attaches without schema surgery (ADR 0002).
3. **Host authority = proof of possession of `hostKeys/{code}`.** The key is write-once,
   top-level, never readable — not by participants, not by hosts after creation. Every
   host-gated write (meta, collectives, wish `collectiveId`, reveal) validates against an
   ephemeral `claims/{code}` node the client writes and clears in `finally`: no standing
   skeleton key exists anywhere in the tree.
4. **Participant writes are self-scoped and pinned.** A participant can only create their
   own avatar claim, their own participant record, and new wishes; wish fields are immutable
   after creation (`text/authorPid/avatarId/createdAt` pinned; only host-gated
   `collectiveId` mutates). Tokens are capped 0–3 per collective by rules, so no client can
   stuff a ballot box beyond ADR 0008.
5. **Session state is world-readable by design.** `/s/{code}` must render for anonymous
   clients, so the ceremony subtree is openly readable. The only secrets (host key, claim)
   live outside it. Read = knowing the code; write = following the rules above.
6. **Enforcement is server-side; the client is honest-but-untrusted.** All writes flow
   through `src/lib/session.ts` and every invariant above is re-stated in rules; the domain
   core (`src/lib/domain.ts`) is pure so both client and tests reason from the same logic.
7. **No moderation, no revocation, no recovery (v1).** We do not ban, mute, eject, or
   reset. Losing the host URL means losing the session (ADR 0010); an abuser with the link
   is handled socially — stop sharing the link — not technically.

## Consequences

- Residual risks accepted for v1: link leakage lets outsiders observe or join (capped by
  the roster); a leaked host key is unrecoverable and instantly transferable — rotate by
  creating a new session; the live database must run the deployed rules, not console rules,
  or `hostKeys/{code}` stays anonymously readable (the pending-deploy note in the v1 PR).
- Trust hardening that would require auth (per-participant accountability, host identity
  recovery, moderation) is explicitly v2 territory alongside GummyGum-native identity
  (ADR 0002, ADR 0012).
- Any future feature that wants to store personal data must first amend this ADR: the
  schema is intentionally incapable of holding it today.
