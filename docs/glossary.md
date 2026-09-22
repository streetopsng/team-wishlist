# Team Wishlist — Glossary

The room's shared language. Code, UI copy, ADRs, and rules use these terms; if a concept
isn't here, either it doesn't exist or it's begging to be named.

## The ceremony

**Team Wishlist** — A facilitated, live team activity: participants anonymously wish for
improvements at work, the host finds common ground, everyone prioritises, and the team's
shared priorities are revealed bottom-up. Not a survey; not a suggestion box.

**Session** — One instance of the ceremony, identified by a short code in the URL
(`/s/{code}` for participants, `/host/{code}?key=…` for the host). All state lives under
`sessions/{code}` in RTDB.

**Host** — The facilitator. The only person who can change phases, match wishes, and drive
the reveal. Identified solely by possession of the session's `hostKey` (ADR 0010). Not an
account; not a participant.

**Participant** — A person in the room who wished and prioritised. Anonymous by design; their
only identity is their avatar (ADR 0003).

**Avatar** — An emoji + background-color pair from the fixed roster. The participant's entire
identity. Unique per session; claiming it is transactional.

**Roster** — The fixed set of 30 avatars. Its size is the hard session cap (ADR 0005).

## Phases

**Phase** — One of the 8 forward-only stages of the session (ADR 0011):
`SETUP → WISHING → WAITING → REVEAL → MATCHING → PRIORITISATION → RESULTS → COMPLETE`.

**WISHING** — Participants submit wishes, then declare "I'm done".

**Wish** — A single anonymous wish for improvement, 1–90 chars, max 5 per participant,
immutable after submit (ADR 0006). Always displayed with its author's avatar, never a name.

**Wish wall** — The shared board of all wishes, seen by everyone from REVEAL onward.

**Collective wish** — A named grouping of 2+ wishes that "ask for the same thing", created by
the host during MATCHING (ADR 0007). The unit that gets prioritised and ranked.

**Matching** — The host-only act of selecting wishes and naming their collective wish. A wish
belongs to at most one collective wish.

**Auto-promotion** — At `MATCHING→PRIORITISATION`, every still-unmatched wish becomes its own
single-wish collective wish, titled with its original text (ADR 0007).

**Priority token** — One of 3 units each participant spends on collective wishes during
PRIORITISATION. Stackable on one card. Private until reveal (ADR 0008).

**Points** — 1 token = 1 point; a collective wish's score is the sum of tokens placed on it.
Ties break by earliest creation. Derived on read, never stored (ADR 0009).

**Reveal** — The RESULTS ceremony: the host clicks through the ranking from last place to
first, one collective wish per click, with the live sidebar filling in (ADR 0009).

## Infrastructure

**RTDB** — Firebase Realtime Database (`europe-west1`), the single source of shared truth
(ADR 0004).

**Host key** — A 128-bit secret embedded in the host URL; the only host credential
(ADR 0010). Never shown after creation.

**Presence** — A participant's `online` flag, driven by RTDB connection state and
`onDisconnect`. Distinct from membership: offline participants stay in the room.

**Ready** — A participant state meaning "finished the current phase's required action";
drives the lobby counters the host sees.
