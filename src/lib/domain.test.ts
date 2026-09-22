import { describe, expect, it } from 'vitest'
import {
  MAX_WISHES,
  NEXT_PHASE,
  PHASES,
  TOKENS_PER_PARTICIPANT,
  WISH_MAX_LENGTH,
  autoPromote,
  canAddToken,
  canSubmitWish,
  computeRanking,
  isForwardTransition,
  isRoomFull,
  isValidWishText,
  revealOrder,
  totalTokens,
  type CollectiveWish,
  type Participant,
  type Wish,
} from './domain'
import { ROSTER_SIZE } from './roster'

describe('phase machine (ADR 0011)', () => {
  it('has 8 phases in order', () => {
    expect(PHASES).toEqual([
      'SETUP',
      'WISHING',
      'WAITING',
      'REVEAL',
      'MATCHING',
      'PRIORITISATION',
      'RESULTS',
      'COMPLETE',
    ])
  })

  it('chains every phase except COMPLETE', () => {
    for (let i = 0; i < PHASES.length - 1; i++) {
      expect(NEXT_PHASE[PHASES[i]]).toBe(PHASES[i + 1])
    }
    expect(NEXT_PHASE.COMPLETE).toBeUndefined()
  })

  it('rejects non-forward transitions', () => {
    expect(isForwardTransition('SETUP', 'RESULTS')).toBe(false)
    expect(isForwardTransition('RESULTS', 'WISHING')).toBe(false)
    expect(isForwardTransition('WISHING', 'SETUP')).toBe(false)
  })
})

describe('wish rules (ADR 0006)', () => {
  it('accepts 1..90 char trimmed wishes', () => {
    expect(isValidWishText('More learning days')).toBe(true)
    expect(isValidWishText('  padded  ')).toBe(true)
    expect(isValidWishText('')).toBe(false)
    expect(isValidWishText('   ')).toBe(false)
    expect(isValidWishText('x'.repeat(WISH_MAX_LENGTH))).toBe(true)
    expect(isValidWishText('x'.repeat(WISH_MAX_LENGTH + 1))).toBe(false)
    expect(isValidWishText(42)).toBe(false)
    expect(isValidWishText(null)).toBe(false)
  })

  it('caps wishes at 5 per participant', () => {
    expect(canSubmitWish(0)).toBe(true)
    expect(canSubmitWish(MAX_WISHES - 1)).toBe(true)
    expect(canSubmitWish(MAX_WISHES)).toBe(false)
  })
})

describe('priority tokens (ADR 0008)', () => {
  it('allows exactly 3 stackable tokens', () => {
    const tokens = { cw1: 2 }
    expect(canAddToken(tokens)).toBe(true)
    expect(canAddToken({ ...tokens, cw1: 3 })).toBe(false)
    expect(totalTokens({ a: 1, b: 2 })).toBe(3)
    expect(totalTokens({ a: TOKENS_PER_PARTICIPANT })).toBe(3)
  })

  it('ignores negative or fractional junk defensively', () => {
    expect(totalTokens({ a: -5, b: 2.7 })).toBe(2)
  })
})

const wish = (id: string, createdAt: number, collectiveId: string | null = null): Wish => ({
  id,
  text: `wish ${id}`,
  authorPid: `p-${id}`,
  avatarId: 'a0',
  createdAt,
  collectiveId,
})

const collective = (id: string, createdAt: number): CollectiveWish => ({
  id,
  title: `Collective ${id}`,
  createdAt,
  autoPromoted: false,
})

const participantWith = (tokens: Record<string, number>): Participant => ({
  pid: 'p1',
  avatarId: 'a0',
  joinedAt: 0,
  online: true,
  doneWishing: false,
  recapSeen: false,
  doneAllocating: false,
  doneResults: false,
  tokens,
})

describe('scoring (ADR 0009)', () => {
  it('points = total tokens on the collective wish', () => {
    const cs = [collective('cw1', 1), collective('cw2', 2)]
    const ps = [participantWith({ cw1: 2, cw2: 1 }), participantWith({ cw1: 1 })]
    const ranking = computeRanking(cs, ps)
    expect(ranking[0].collective.id).toBe('cw1')
    expect(ranking[0].points).toBe(3)
    expect(ranking[1].points).toBe(1)
    expect(ranking.map((r) => r.rank)).toEqual([1, 2])
  })

  it('breaks ties by earliest createdAt', () => {
    const cs = [collective('late', 100), collective('early', 50)]
    const ranking = computeRanking(cs, [participantWith({ late: 2, early: 2 })])
    expect(ranking[0].collective.id).toBe('early')
  })

  it('ignores tokens pointing at unknown collectives', () => {
    const cs = [collective('cw1', 1)]
    const ranking = computeRanking(cs, [participantWith({ cw1: 1, ghost: 5 })])
    expect(ranking[0].points).toBe(1)
  })

  it('shows zero-point collectives last (every group gets closure)', () => {
    const cs = [collective('cw1', 1), collective('zero', 2)]
    const ranking = computeRanking(cs, [participantWith({ cw1: 3 })])
    expect(ranking[1].collective.id).toBe('zero')
    expect(ranking[1].points).toBe(0)
  })

  it('reveals bottom-up: last place first, #1 last', () => {
    const cs = [collective('cw1', 1), collective('cw2', 2), collective('cw3', 3)]
    const ranking = computeRanking(cs, [participantWith({ cw1: 3, cw2: 2 })])
    const order = revealOrder(ranking).map((r) => r.collective.id)
    expect(order).toEqual(['cw3', 'cw2', 'cw1'])
  })
})

describe('auto-promotion (ADR 0007)', () => {
  it('promotes only ungrouped wishes into single-wish collectives', () => {
    const cs = [collective('cw-kept', 1)]
    const wishes = [wish('w1', 10, 'cw-kept'), wish('w2', 20), wish('w3', 30)]
    const result = autoPromote(wishes, cs)
    expect(result.collectives).toHaveLength(3)
    expect(result.assignments).toEqual({ w2: 'cw-auto-w2', w3: 'cw-auto-w3' })
    const promoted = result.collectives.find((c) => c.id === 'cw-auto-w2')
    expect(promoted?.autoPromoted).toBe(true)
    expect(promoted?.title).toBe('wish w2')
  })

  it('never reassigns wishes that already belong to a collective', () => {
    const wishes = [wish('w1', 10, 'some-cw')]
    const result = autoPromote(wishes, [])
    expect(result.assignments).toEqual({})
    expect(result.collectives).toHaveLength(0)
  })
})

describe('room capacity (ADR 0005)', () => {
  it('is full only when every roster avatar is claimed', () => {
    expect(isRoomFull([])).toBe(false)
    const ids = Array.from({ length: ROSTER_SIZE - 1 }, (_, i) => `a${i}`)
    expect(isRoomFull(ids)).toBe(false)
    expect(isRoomFull([...ids, 'a29'])).toBe(true)
  })
})
