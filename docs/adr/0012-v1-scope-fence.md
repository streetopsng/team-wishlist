# ADR 0012: v1 fence line — what we are deliberately NOT building

- Status: Accepted
- Date: 2026-09-22

## Context

The grill surfaced many tempting features (editing, exports, host accounts, session lists,
email). v1 must prove the *ceremony*, not staff a product org. Every "no" below is an explicit
decision, not an omission.

## Decision — out of scope for v1

1. **No wish editing/deletion** after submit (ADR 0006).
2. **No host accounts or passphrases** — the secret link is the only host credential
   (ADR 0010).
3. **No CSV/any export** of results; the host reads them off the screen.
4. **No multiple sessions or session lists** — the app is URL-driven; a fresh session is a
   fresh URL.
5. **No email sending** — the host distributes the join link through their own channel
   (ADR 0001). GummyGum will own this later (ADR 0002).
6. **No chat, reactions, or moderation tools** inside the room.
7. **No renaming/dissolving collective wishes** after save (ADR 0007).
8. **No i18n** beyond the copy as written (English), and no theming beyond the prototype's
   palette.

## Consequences

- The result screen should make manual capture easy (clean layout, no truncation) since hosts
  will screenshot.
- Several of these are natural v2 bets: exports first (host pull request in every debrief),
  then sessions list, then GummyGum-native identity.
