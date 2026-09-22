/**
 * Session operations — all RTDB writes live here (ADR 0004).
 *
 * Every mutating function takes an explicit `claim` (host key or existing
 * participant) so the UI layer can never accidentally write without one.
 * Rules in database.rules.json are the real boundary; these helpers keep the
 * client honest and typed.
 */
import {
  get,
  onDisconnect,
  onValue,
  push,
  ref,
  remove,
  runTransaction,
  set,
  update,
} from 'firebase/database'
import {
  MAX_WISHES,
  type CollectiveWish,
  type Participant,
  type Phase,
  type Wish,
} from './domain'
import { db } from './firebase'

export interface SessionMeta {
  name: string
  phase: Phase
  createdAt: number
  cap: number
  invitedCount: number
  source: string
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
          cap: Number(metaRaw.cap ?? 30),
          invitedCount: Number(metaRaw.invitedCount ?? 0),
          source: String(metaRaw.source ?? 'standalone'),
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
 */
export async function createSession(
  name: string,
  invitedCount: number,
): Promise<{ code: string; hostKey: string }> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateSessionCode()
    const hostKey = generateHostKey()
    const meta: SessionMeta & { hostKey: string } = {
      name,
      phase: 'SETUP',
      createdAt: Date.now(),
      cap: 30,
      invitedCount,
      source: 'standalone', // ADR 0002: GummyGum-shaped seam
      hostKey,
    }
    const created = await runTransaction(sessionRef(code), (current) => {
      if (current !== null) return undefined // code taken — abort, retry with a new one
      return { meta }
    })
    if (created.committed) return { code, hostKey }
  }
  throw new Error('Could not generate a unique session code — try again')
}

/** Participant claims an avatar transactionally (ADR 0003/0005). */
export async function joinSession(
  code: string,
  avatarId: string,
): Promise<{ pid: string }> {
  const pid = generatePid()
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
export async function saveCollective(
  code: string,
  hostKey: string,
  selectedWishIds: string[],
  title: string,
): Promise<void> {
  await verifyHost(code, hostKey)
  const cid = `cw-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
  const updates: Record<string, unknown> = {
    [`collectives/${cid}`]: { title, createdAt: Date.now(), autoPromoted: false },
  }
  for (const wid of selectedWishIds) updates[`wishes/${wid}/collectiveId`] = cid
  await update(sessionRef(code), updates)
}

export async function setPhase(code: string, hostKey: string, phase: Phase): Promise<void> {
  await verifyHost(code, hostKey)
  await set(ref(db, `sessions/${code}/meta/phase`), phase)
}

export async function setRevealIndex(
  code: string,
  hostKey: string,
  index: number,
): Promise<void> {
  await verifyHost(code, hostKey)
  await set(ref(db, `sessions/${code}/reveal/index`), index)
}

/**
 * Apply auto-promotion atomically (ADR 0007): write new single-wish collectives
 * and set collectiveId on every previously-ungrouped wish.
 */
export async function applyAutoPromotion(
  code: string,
  collectives: CollectiveWish[],
  assignments: Record<string, string>,
): Promise<void> {
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
}

/** Participant self-service writes. */
export async function markDone(
  code: string,
  participant: Participant,
  field: 'doneWishing' | 'recapSeen' | 'doneAllocating' | 'doneResults',
): Promise<void> {
  await set(ref(db, `sessions/${code}/participants/${participant.pid}/${field}`), true)
}

export async function setTokens(
  code: string,
  participant: Participant,
  tokens: Record<string, number>,
): Promise<void> {
  await set(ref(db, `sessions/${code}/participants/${participant.pid}/tokens`), tokens)
}

/** Presence: online flag cleared on disconnect (ADR 0004). */
export function registerPresence(code: string, pid: string): () => void {
  const statusRef = ref(db, `sessions/${code}/participants/${pid}/online`)
  const conn = ref(db, '.info/connected')
  onDisconnect(statusRef).set(false)
  const unsub = onValue(conn, (snap) => {
    if (snap.val() === true) set(statusRef, true).catch(() => undefined)
  })
  return () => {
    unsub()
    set(statusRef, false).catch(() => undefined)
  }
}

/** Host proof-of-possession: rules validate the claim against meta/hostKey. */
async function verifyHost(code: string, hostKey: string): Promise<void> {
  const claim = await runTransaction(ref(db, `sessions/${code}/hostClaim`), () => hostKey)
  if (!claim.committed) throw new Error('Host verification failed')
}
