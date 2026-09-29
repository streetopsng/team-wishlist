import { describe, expect, it } from 'vitest'
import { AVATAR_IDS, ROSTER_SIZE, avatarUrl, isAvatarId } from './roster'

describe('avatar roster', () => {
  it('is the 26-avatar GummyGum hub set (ADR 0005)', () => {
    expect(ROSTER_SIZE).toBe(26)
    expect(new Set(AVATAR_IDS).size).toBe(26)
    expect(AVATAR_IDS[0]).toBe('av-1')
    expect(AVATAR_IDS[25]).toBe('av-26')
  })

  it('ids fit the rules limit on avatarId length', () => {
    for (const id of AVATAR_IDS) expect(id.length).toBeLessThanOrEqual(8)
  })

  it('resolves hub URLs and falls back for unknown ids', () => {
    expect(isAvatarId('av-26')).toBe(true)
    expect(isAvatarId('av-27')).toBe(false)
    expect(avatarUrl('av-7')).toBe('https://gummygum.app/avatars/av-7.svg')
    expect(avatarUrl('a3')).toBe('https://gummygum.app/avatars/av-1.svg')
  })
})
