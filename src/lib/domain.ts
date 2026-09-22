/**
 * Pure domain logic for Team Wishlist.
 *
 * Everything here is deterministic and Firebase-free so it can be unit tested
 * (AGENT.MD rule 2: test first) and reused on any client.
 * Domain language is defined in docs/glossary.md; decisions in docs/adr/.
 */
import { ROSTER_SIZE } from './roster'

/** The 8 forward-only phases of the session (ADR 0011). */
export const PHASES = [
  'SETUP',
  'WISHING',
  'WAITING',
  'REVEAL',
  'MATCHING',
  'PRIORITISATION',
  'RESULTS',
  'COMPLETE',
] as const

export type Phase = (typeof PHASES)[number]

/** Experience constants (ADR 0006, ADR 0008). */
export const MAX_WISHES = 5
export const WISH_MAX_LENGTH = 90
export const TOKENS_PER_PARTICIPANT = 3
export const MIN_COLLECTIVE_SIZE = 2

/** Host-only phase ladder: current phase -> next phase (ADR 0011). */
export const NEXT_PHASE: Partial<Record<Phase, Phase>> = {
  SETUP: 'WISHING',
  WISHING: 'WAITING',
  WAITING: 'REVEAL',
  REVEAL: 'MATCHING',
  MATCHING: 'PRIORITISATION',
  PRIORITISATION: 'RESULTS',
  RESULTS: 'COMPLETE',
}

export function isForwardTransition(from: Phase, to: Phase): boolean {
  return NEXT_PHASE[from] === to
}

/** A single anonymous wish (ADR 0006). */
export interface Wish {
  id: string
  text: string
  authorPid: string
  avatarId: string
  createdAt: number
  /** Set when the host groups this wish into a collective wish (ADR 0007). */
  collectiveId: string | null
}

/** A named grouping of 2+ wishes, or an auto-promoted single (ADR 0007). */
export interface CollectiveWish {
  id: string
  title: string
  createdAt: number
  /** True when this card was auto-promoted from one ungrouped wish. */
  autoPromoted: boolean
}

/** A participant's immutable identity plus per-phase progress flags. */
export interface Participant {
  pid: string
  avatarId: string
  joinedAt: number
  online: boolean
  doneWishing: boolean
  recapSeen: boolean
  doneAllocating: boolean
  doneResults: boolean
  /** Priority tokens per collective wish id (ADR 0008). */
  tokens: Record<string, number>
}

/** A rank entry derived on read — never stored (ADR 0009). */
export interface RankEntry {
  collective: CollectiveWish
  points: number
  rank: number
}

export function isValidWishText(text: unknown): text is string {
  if (typeof text !== 'string') return false
  const trimmed = text.trim()
  return trimmed.length >= 1 && trimmed.length <= WISH_MAX_LENGTH
}

/** A participant may hold 0..MAX_WISHES wishes; submitting more is refused. */
export function canSubmitWish(wishCount: number): boolean {
  return wishCount < MAX_WISHES
}

/** Total priority tokens across all collective wishes for one participant. */
export function totalTokens(tokens: Record<string, number>): number {
  return Object.values(tokens).reduce((sum, n) => sum + (n > 0 ? Math.floor(n) : 0), 0)
}

/** Can the participant place one more token? (tokens stack, ADR 0008) */
export function canAddToken(tokens: Record<string, number>): boolean {
  return totalTokens(tokens) < TOKENS_PER_PARTICIPANT
}

/** Ranking derived from tokens: 1 token = 1 point, ties by earliest creation (ADR 0009). */
export function computeRanking(
  collectives: CollectiveWish[],
  participants: Participant[],
): RankEntry[] {
  const points = new Map<string, number>()
  for (const c of collectives) points.set(c.id, 0)
  for (const p of participants) {
    for (const [cid, n] of Object.entries(p.tokens)) {
      if (points.has(cid) && n > 0) points.set(cid, points.get(cid)! + Math.floor(n))
    }
  }
  const ranked = collectives.map((c) => ({ collective: c, points: points.get(c.id)! }))
  ranked.sort(
    (a, b) =>
      b.points - a.points || a.collective.createdAt - b.collective.createdAt,
  )
  return ranked.map((r, i) => ({ ...r, rank: i + 1 }))
}

/** Reveal order for RESULTS: bottom-up, last place first (ADR 0009). */
export function revealOrder(ranking: RankEntry[]): RankEntry[] {
  return [...ranking].reverse()
}

/**
 * Auto-promotion at MATCHING->PRIORITISATION (ADR 0007): every still-unmatched
 * wish becomes its own single-wish collective wish titled with its original text.
 * Pure: returns the new collectives and the wish->collective assignments.
 */
export function autoPromote(
  wishes: Wish[],
  collectives: CollectiveWish[],
): { collectives: CollectiveWish[]; assignments: Record<string, string> } {
  const taken = new Set(wishes.map((w) => w.collectiveId).filter((x): x is string => x !== null))
  const promoted = wishes
    .filter((w) => w.collectiveId === null)
    .map((w) => {
      const cid = `cw-auto-${w.id}`
      return { wish: w, cid }
    })
  const newCollectives: CollectiveWish[] = promoted.map(({ wish, cid }) => ({
    id: cid,
    title: wish.text,
    createdAt: wish.createdAt,
    autoPromoted: true,
  }))
  const assignments: Record<string, string> = {}
  for (const { wish, cid } of promoted) assignments[wish.id] = cid
  void taken
  return { collectives: [...collectives, ...newCollectives], assignments }
}

/** True when every avatar in the roster is claimed — the room is full (ADR 0005). */
export function isRoomFull(claimedAvatarIds: string[]): boolean {
  return new Set(claimedAvatarIds).size >= ROSTER_SIZE
}
