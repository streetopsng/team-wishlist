/** The avatar roster: 30 unique emoji + background-color pairs (ADR 0005). */

export const BG_COLORS = ['green', 'blue', 'pink', 'yellow', 'coral', 'greenLight'] as const
export type BgColor = (typeof BG_COLORS)[number]

const EMOJI_ROWS: ReadonlyArray<ReadonlyArray<string>> = [
  ['🦊', '🐨', '🐼', '🐸', '🦉'],
  ['🦁', '🐺', '🐯', '🦋', '🐝'],
  ['🐰', '🐙', '🐳', '🦔', '🐢'],
  ['🦩', '🐧', '🦝', '🐬', '🦜'],
  ['🦄', '🐘', '🦕', '🦖', '🦚'],
  ['🐿️', '🦦', '🦥', '🦨', '🦎'],
]

export const AVATARS: ReadonlyArray<{ id: string; emoji: string; bg: BgColor }> =
  EMOJI_ROWS.flatMap((row, rowIndex) =>
    row.map((emoji, colIndex) => ({
      id: `a${rowIndex * 5 + colIndex}`,
      emoji,
      bg: BG_COLORS[rowIndex % BG_COLORS.length],
    })),
  )

export const ROSTER_SIZE = AVATARS.length

export function avatarById(id: string): { id: string; emoji: string; bg: BgColor } | undefined {
  return AVATARS.find((a) => a.id === id)
}

/** Deduplicated roster check — guards against copy/paste emoji collisions. */
export const ROSTER_IS_UNIQUE =
  new Set(AVATARS.map((a) => a.emoji)).size === ROSTER_SIZE
