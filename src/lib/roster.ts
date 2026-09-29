/** The avatar roster: the GummyGum hub avatar set every experience hotlinks (ADR 0005). */

export const GUMMYGUM_AVATAR_BASE_URL = 'https://gummygum.app/avatars'

export const AVATAR_IDS: ReadonlyArray<string> = Array.from({ length: 26 }, (_, i) => `av-${i + 1}`)

export const ROSTER_SIZE = AVATAR_IDS.length

export const DEFAULT_AVATAR_ID = 'av-1'

export function isAvatarId(id: string): boolean {
  return AVATAR_IDS.includes(id)
}

export function avatarUrl(id: string): string {
  return `${GUMMYGUM_AVATAR_BASE_URL}/${isAvatarId(id) ? id : DEFAULT_AVATAR_ID}.svg`
}

export function avatarLabel(id: string): string {
  return isAvatarId(id) ? `Avatar ${id.slice(3)}` : 'Avatar'
}
