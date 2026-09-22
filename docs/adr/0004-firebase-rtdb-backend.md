# ADR 0004: Firebase Realtime Database as the backend

- Status: Accepted
- Date: 2026-09-22

## Context

ADR 0001 requires true real-time sync (phase changes, wish wall updates, ready counters, live
rankings during the reveal). The repo already contains `src/firebase.config.ts` pointing at a
Firebase project (`team-wishlist-9f81a`) with a **Realtime Database** in `europe-west1`. The
`firebase` npm package is not installed yet — wiring it up is part of this build.

## Decision

Use **Cloud Firestore's older sibling, RTDB**, exactly as the existing config implies. One top
node per session; all clients subscribe to their session's subtree.

```
sessions/{code}
  meta/         { name, phase, createdAt, invitedCount, source, hostKey, cap }
  participants/{pid}/ { avatarId, joinedAt, online, doneWishing, doneAllocating,
                        doneResults, recapSeen, tokens/{cid: n} }
  wishes/{wid}/       { text, authorPid, avatarId, createdAt, collectiveId|null }
  collectives/{cid}/  { title, createdAt }        // membership = wishes with collectiveId
  reveal/       { index }                          // host-driven reveal cursor
```

- **Presence**: each participant writes `online:true` on connect and registers
  `onDisconnect().set(false)`; derived counters (ready / done) are computed client-side from
  the subtree.
- **Phase machine**: only the `hostKey` holder may write `meta/phase` and `reveal/index`
  (enforced in security rules).
- **Avatar claims and wish submission** go through RTDB transactions so concurrent joins and
  double-submits stay consistent.
- **Scoring** (ADR 0009) is derived, not stored: any client can compute the ranking from
  `participants/*/tokens` + `collectives`. No aggregation node to drift out of sync.

## Consequences

- Native latency and presence fit the live ceremony; no polling layer to write.
- RTDB rules become the real security boundary: the host key in `meta/` must be readable only
  by hosts (rule keyed on a query param won't work — the host client presents the key by
  writing it to a `hostClaim` node that rules compare; final rule design lands with the build).
- Database is region-locked to `europe-west1` — fine for the team's location.
- Analytics (`getAnalytics`) is initialized in the existing config; harmless, kept.
