import { describe, expect, it } from 'vitest'
import { AVATARS, BG_COLORS, ROSTER_IS_UNIQUE, ROSTER_SIZE, avatarById } from './roster'

describe('avatar roster', () => {
  it('has exactly 30 avatars (ADR 0005)', () => {
    expect(ROSTER_SIZE).toBe(30)
    expect(AVATARS).toHaveLength(30)
  })

  it('contains no duplicate emojis at all — the avatar is the identity (ADR 0003)', () => {
    expect(ROSTER_IS_UNIQUE).toBe(true)
  })

  it('uses only palette colors', () => {
    for (const a of AVATARS) expect(BG_COLORS).toContain(a.bg)
  })

  it('resolves avatars by id', () => {
    expect(avatarById('a0')).toBeDefined()
    expect(avatarById('a29')).toBeDefined()
    expect(avatarById('a30')).toBeUndefined()
  })

  it('has non-empty emoji strings', () => {
    for (const a of AVATARS) expect(a.emoji.length).toBeGreaterThan(0)
  })
})
