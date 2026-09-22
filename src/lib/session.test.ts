import { describe, expect, it } from 'vitest'
import { hydrateCollectives, hydrateParticipants, hydrateWishes } from './session'

/**
 * Source-level contract: the meta record written to RTDB must never contain the
 * host key. (The runtime rules contract lives in rules.test.ts; this guards the
 * client side of the same P0 — caught live when a smoke test still found the
 * key in meta after the rules were fixed.)
 */
import { readFileSync } from 'node:fs'

it('createSession writes meta without a hostKey field (P0: cascading read)', () => {
  const src = readFileSync(new URL('./session.ts', import.meta.url), 'utf8')
  const metaBlock = src.slice(src.indexOf('const meta: SessionMeta'), src.indexOf('runTransaction(sessionRef'))
  expect(metaBlock).not.toContain('hostKey')
})

describe('hydrate: RTDB values lack their key, empty objects are dropped (ADR 0004)', () => {
  it('injects wish id from the record key and defaults collectiveId to null', () => {
    const wishes = hydrateWishes({
      w1: { text: 'More learning', authorPid: 'p1', avatarId: 'a0', createdAt: 1 },
    })
    expect(wishes).toEqual([
      {
        id: 'w1',
        text: 'More learning',
        authorPid: 'p1',
        avatarId: 'a0',
        createdAt: 1,
        collectiveId: null,
      },
    ])
  })

  it('injects participant pid and defaults missing tokens to empty object', () => {
    const participants = hydrateParticipants({
      p1: { avatarId: 'a0', joinedAt: 1, online: true, doneWishing: false },
      p2: { avatarId: 'a1', joinedAt: 2, tokens: { cw1: 2 } },
    })
    expect(participants[0].pid).toBe('p1')
    expect(participants[0].tokens).toEqual({})
    expect(participants[1].tokens).toEqual({ cw1: 2 })
  })

  it('injects collective id, defaults autoPromoted, sorts by createdAt', () => {
    const collectives = hydrateCollectives({
      cw2: { title: 'B', createdAt: 5 },
      cw1: { title: 'A', createdAt: 2 },
    })
    expect(collectives.map((c) => c.id)).toEqual(['cw1', 'cw2'])
    expect(collectives[0].autoPromoted).toBe(false)
  })

  it('handles null/undefined records (RTDB drops empty subtrees)', () => {
    expect(hydrateWishes(null)).toEqual([])
    expect(hydrateParticipants(undefined)).toEqual([])
    expect(hydrateCollectives(null)).toEqual([])
  })
})
