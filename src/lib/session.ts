/**
 * Session operations — all RTDB writes live here (ADR 0004).
 *
 * Every mutating function takes an explicit `claim` (host key or existing
 * participant) so the UI layer can never accidentally write without one.
 * Rules in database.rules.json are the real boundary; these helpers keep the
 * client honest and typed.
 */
import { onDisconnect, push, ref, serverTimestamp } from 'firebase/database'
import {
  MAX_WISHES,
  type CollectiveWish,
  type Participant,
  type Phase,
  type Wish,
} from './domain'
import { db, get, onValue, remove, runTransaction, set, update } from './firebase'
import { ROSTER_SIZE } from './roster'

export interface SessionMeta {
  name: string
  phase: Phase
  createdAt: number
  cap: number
  invitedCount: number
  source: string
  phaseChangedAt?: number
  abandoned?: boolean
  ended?: boolean
}

export interface SessionSnapshot {
  meta: SessionMeta
  participants: Participant[]
  wishes: Wish[]
  collectives: CollectiveWish[]
  revealIndex: number
}

/**
 * Hydrated raw records (values lack their key, empty objects are dropped).
 */
type RawRecord<T> = Partial<T> & Record<string, unknown>

export function hydrateWishes(raw: unknown): Wish[] {
  const out: Wish[] = []
  for (const [id, value] of Object.entries((raw as Record<string, RawRecord<Wish>> | null) ?? {})) {
    const w = value as Partial<Wish>
    out.push({
      id,
      text: String(w.text ?? ''),
      authorPid: String(w.authorPid ?? ''),
      avatarId: String(w.avatarId ?? ''),
      createdAt: Number(w.createdAt ?? 0),
      collectiveId:
        w.collectiveId === null || w.collectiveId === undefined ? null : String(w.collectiveId),
    })
  }
  return out.sort((a, b) => a.createdAt - b.createdAt)
}

export function hydrateParticipants(raw: unknown): Participant[] {
  const out: Participant[] = []
  for (const [pid, value] of Object.entries(
    (raw as Record<string, RawRecord<Participant>> | null) ?? {},
  )) {
    const p = value as Partial<Participant>
    out.push({
      pid,
      avatarId: String(p.avatarId ?? ''),
      joinedAt: Number(p.joinedAt ?? 0),
      online: Boolean(p.online),
      doneWishing: Boolean(p.doneWishing),
      recapSeen: Boolean(p.recapSeen),
      doneAllocating: Boolean(p.doneAllocating),
      doneResults: Boolean(p.doneResults),
      tokens: (p.tokens as Record<string, number> | undefined) ?? {},
      lastSeen: Number(p.lastSeen ?? 0),
    })
  }
  return out
}

export function hydrateCollectives(raw: unknown): CollectiveWish[] {
  const out: CollectiveWish[] = []
  for (const [id, value] of Object.entries(
    (raw as Record<string, RawRecord<CollectiveWish>> | null) ?? {},
  )) {
    const c = value as Partial<CollectiveWish>
    out.push({
      id,
      title: String(c.title ?? ''),
      createdAt: Number(c.createdAt ?? 0),
      autoPromoted: Boolean(c.autoPromoted),
    })
  }
  return out.sort((a, b) => a.createdAt - b.createdAt)
}

const sessionRef = (code: string) => ref(db, `sessions/${code}`)

/** Subscribe to the live session subtree. Returns the unsubscribe function. */
export function subscribeSession(
  code: string,
  onUpdate: (snap: SessionSnapshot | null) => void,
  onError: (err: Error) => void,
): () => void {
  return onValue(
    sessionRef(code),
    (snapshot) => {
      if (!snapshot.exists()) {
        onUpdate(null)
        return
      }
      const raw = snapshot.val() as Record<string, unknown>
      const metaRaw = (raw.meta ?? {}) as Record<string, unknown>
      onUpdate({
        meta: {
          name: String(metaRaw.name ?? ''),
          phase: (metaRaw.phase ?? 'SETUP') as Phase,
          createdAt: Number(metaRaw.createdAt ?? 0),
          cap: Number(metaRaw.cap ?? ROSTER_SIZE),
          invitedCount: Number(metaRaw.invitedCount ?? 0),
          source: String(metaRaw.source ?? 'standalone'),
          phaseChangedAt: Number(metaRaw.phaseChangedAt ?? 0),
          abandoned: Boolean(metaRaw.abandoned),
          ended: Boolean(metaRaw.ended),
        },
        participants: hydrateParticipants(raw.participants),
        wishes: hydrateWishes(raw.wishes),
        collectives: hydrateCollectives(raw.collectives),
        revealIndex:
          ((raw.reveal as Record<string, unknown> | undefined)?.index as number) ?? -1,
      })
    },
    onError,
  )
}

/** Generate an unguessable code + host key (ADR 0010). */
export function generateSessionCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // no I/L/O/0/1 — readable out loud
  let code = ''
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  for (const b of bytes) code += alphabet[b % alphabet.length]
  return code
}

export function generateHostKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16)) // 128-bit, ADR 0010
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function generatePid(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Create a session atomically. Refuses if the code somehow already exists.
 * Returns the host key so the caller can build the control URL.
 * `presetCode` pins the session to the GummyGum hub's room code (ADR 0002).
 */
export async function createSession(
  name: string,
  invitedCount: number,
  presetCode?: string,
  presetHostKey?: string,
): Promise<{ code: string; hostKey: string }> {
  const attempts = presetCode ? 1 : 5
  for (let attempt = 0; attempt < attempts; attempt++) {
    const code = presetCode ?? generateSessionCode()
    const hostKey = presetHostKey ?? generateHostKey()
    const meta: SessionMeta = {
      name,
      phase: 'SETUP',
      createdAt: Date.now(),
      cap: ROSTER_SIZE, // ADR 0005: cap = roster size, single source of truth
      invitedCount,
      source: presetCode ? 'gummygum' : 'standalone', // ADR 0002: GummyGum-shaped seam
    }
    const created = await runTransaction(sessionRef(code), (current) => {
      if (current !== null) return undefined // code taken — abort, retry with a new one
      return { meta }
    })
    if (created.committed) {
      // The key lives OUTSIDE the readable session subtree (rules P0 fix): a child
      // `.read: false` cannot revoke a cascading read, so sessions/$code/meta must
      // never hold it. Write-once at the top level, never readable.
      await set(ref(db, `hostKeys/${code}`), hostKey)
      return { code, hostKey }
    }
    if (presetCode) throw new Error('A session already exists for this room')
  }
  throw new Error('Could not generate a unique session code — try again')
}

/**
 * A GummyGum invitee's pid is derived from their invite email so a rejoin from any
 * device lands on the same participant, while the room only ever sees an opaque hash.
 */
export async function invitePid(code: string, email: string | null | undefined): Promise<string | null> {
  const normalized = (email ?? '').trim().toLowerCase()
  if (!normalized || !globalThis.crypto?.subtle) return null
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`tw:${code}:${normalized}`))
  return Array.from(new Uint8Array(digest).slice(0, 8), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Participant claims an avatar transactionally (ADR 0003/0005). */
export async function joinSession(
  code: string,
  avatarId: string,
  presetPid?: string | null,
): Promise<{ pid: string }> {
  const pid = presetPid || generatePid()
  const participantRecord: Omit<Participant, 'pid'> = {
    avatarId,
    joinedAt: Date.now(),
    online: true,
    doneWishing: false,
    recapSeen: false,
    doneAllocating: false,
    doneResults: false,
    tokens: {},
  }

  // Avatar uniqueness first: claim on the avatar registry (ADR 0005).
  const avatarClaim = await runTransaction(ref(db, `sessions/${code}/avatars/${avatarId}`), (cur) => {
    if (cur !== null) return // already claimed — abort
    return pid
  })
  if (!avatarClaim.committed || avatarClaim.snapshot.val() !== pid) {
    throw new Error('That avatar was just taken — pick another')
  }

  const claimResult = await runTransaction(ref(db, `sessions/${code}/participants/${pid}`), () => {
    // pid lives in the record's key — never inside the value (RTDB strips nothing,
    // but writing it inside would duplicate identity)
    return participantRecord satisfies Omit<Participant, 'pid'>
  })
  if (!claimResult.committed) {
    await remove(ref(db, `sessions/${code}/avatars/${avatarId}`))
    throw new Error('Join failed — try again')
  }
  return { pid }
}

/** Submit one wish (ADR 0006). Refuses beyond 5; rules enforce 90 chars. */
export async function submitWish(
  code: string,
  participant: Participant,
  text: string,
  myWishCount: number,
): Promise<void> {
  if (myWishCount >= MAX_WISHES) throw new Error('Wish limit reached')
  const wishRef = push(ref(db, `sessions/${code}/wishes`))
  await set(wishRef, {
    text: text.trim(),
    authorPid: participant.pid,
    avatarId: participant.avatarId,
    createdAt: Date.now(),
    collectiveId: null,
  })
}

/** Host groups selected wishes into a named collective wish (ADR 0007). */
export function saveCollective(
  code: string,
  hostKey: string,
  selectedWishIds: string[],
  title: string,
): Promise<void> {
  return withHost(code, hostKey, async () => {
    const cid = `cw-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const updates: Record<string, unknown> = {
      [`collectives/${cid}`]: { title, createdAt: Date.now(), autoPromoted: false },
    }
    for (const wid of selectedWishIds) updates[`wishes/${wid}/collectiveId`] = cid
    await update(sessionRef(code), updates)
  })
}

export function setPhase(code: string, hostKey: string, phase: Phase): Promise<void> {
  return withHost(code, hostKey, () =>
    update(ref(db, `sessions/${code}/meta`), { phase, phaseChangedAt: Date.now() }),
  )
}

export function markSessionAbandoned(code: string, hostKey: string): Promise<void> {
  return withHost(code, hostKey, () => set(ref(db, `sessions/${code}/meta/abandoned`), true))
}

export function markSessionEnded(code: string, hostKey: string): Promise<void> {
  return withHost(code, hostKey, () => set(ref(db, `sessions/${code}/meta/ended`), true))
}

export function setRevealIndex(code: string, hostKey: string, index: number): Promise<void> {
  return withHost(code, hostKey, () => set(ref(db, `sessions/${code}/reveal/index`), index))
}

/**
 * Apply auto-promotion atomically (ADR 0007): write new single-wish collectives
 * and set collectiveId on every previously-ungrouped wish.
 */
export function applyAutoPromotion(
  code: string,
  hostKey: string,
  collectives: CollectiveWish[],
  assignments: Record<string, string>,
): Promise<void> {
  return withHost(code, hostKey, async () => {
    const updates: Record<string, unknown> = {}
    const existing = await get(ref(db, `sessions/${code}/collectives`))
    const existingIds = new Set(Object.keys((existing.val() as Record<string, unknown>) ?? {}))
    for (const c of collectives) {
      if (!existingIds.has(c.id)) updates[`collectives/${c.id}`] = c
    }
    for (const [wid, cid] of Object.entries(assignments)) {
      updates[`wishes/${wid}/collectiveId`] = cid
    }
    if (Object.keys(updates).length === 0) return
    await update(sessionRef(code), updates)
  })
}

/** Participant self-service writes. */
export async function markDone(
  code: string,
  participant: Participant,
  field: 'doneWishing' | 'recapSeen' | 'doneAllocating' | 'doneResults',
): Promise<void> {
  await withRetry(() => set(ref(db, `sessions/${code}/participants/${participant.pid}/${field}`), true))
}

export async function setTokens(
  code: string,
  participant: Participant,
  tokens: Record<string, number>,
): Promise<void> {
  await set(ref(db, `sessions/${code}/participants/${participant.pid}/tokens`), tokens)
}

/**
 * Presence: online flag cleared on disconnect (ADR 0004).
 * Re-arms at most one onDisconnect per (re)connection and cancels stale ones
 * when the effect re-runs, so registrations don't pile up.
 */
export function registerPresence(code: string, pid: string): () => void {
  const participantRef = ref(db, `sessions/${code}/participants/${pid}`)
  const statusRef = ref(db, `sessions/${code}/participants/${pid}/online`)
  const conn = ref(db, '.info/connected')
  let cancelDisconnect: (() => void) | null = null
  const unsub = onValue(conn, (snap) => {
    if (snap.val() === true) {
      cancelDisconnect?.()
      const d = onDisconnect(participantRef)
      // lastSeen lets a returning client tell an abandoned room from a live one.
      void d.update({ online: false, lastSeen: serverTimestamp() }).catch(() => undefined)
      cancelDisconnect = () => void d.cancel().catch(() => undefined)
      set(statusRef, true).catch(() => undefined)
    }
  })
  return () => {
    unsub()
    cancelDisconnect?.()
    update(participantRef, { online: false, lastSeen: serverTimestamp() }).catch(() => undefined)
  }
}

/**
 * Host proof-of-possession (ADR 0010, rules P0 fix).
 *
 * The client presents the key by writing it to the top-level `claims/{code}`
 * node; rules accept the write only when it equals `hostKeys/{code}` — which
 * no client can read. Host-gated writes (meta, collectives, wish updates,
 * reveal) check the claim server-side. The claim is cleared in a `finally` so
 * a lingering claim can't become a standing skeleton key for the room.
 */
class HostClaimError extends Error {}

const WRITE_ATTEMPTS = 5
const WRITE_RETRY_MS = 1000
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (err instanceof HostClaimError || attempt >= WRITE_ATTEMPTS) throw err
      await wait(WRITE_RETRY_MS)
    }
  }
}

async function claimAndRun<T>(code: string, hostKey: string, fn: () => Promise<T>): Promise<T> {
  await set(ref(db, `claims/${code}`), hostKey).catch(() => {
    throw new HostClaimError('Host verification failed — check the host link')
  })
  try {
    return await fn()
  } finally {
    await remove(ref(db, `claims/${code}`)).catch(() => undefined)
  }
}

// One host write at a time: overlapping calls would let the first one's cleanup
// remove the claim the second still needs, and its write would be denied.
let hostQueue: Promise<unknown> = Promise.resolve()

function withHost<T>(code: string, hostKey: string, fn: () => Promise<T>): Promise<T> {
  const run = hostQueue.then(() => withRetry(() => claimAndRun(code, hostKey, fn)))
  hostQueue = run.catch(() => undefined)
  return run
}
