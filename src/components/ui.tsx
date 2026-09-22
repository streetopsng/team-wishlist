/** Shared presentational components, ported from the prototype. */
import type { ReactNode } from 'react'
import type { CollectiveWish, Wish } from '@/lib/domain'
import { avatarById, type BgColor } from '@/lib/roster'

const ICONS: Record<string, string> = {
  people:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" width="14" height="14"><circle cx="8.5" cy="8" r="2.6"/><circle cx="16" cy="9" r="2.2"/><path d="M3 19c.5-3 2.6-4.6 5.5-4.6S13.5 16 14 19M14 19c.4-2.3 2-3.6 4.3-3.6S22 17 22.4 19"/></svg>',
  star:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" width="14" height="14"><path d="M12 3l2.6 5.9 6.4.6-4.8 4.3 1.4 6.2L12 16.9 6.4 20l1.4-6.2L3 9.5l6.4-.6L12 3Z"/></svg>',
  bulb:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" width="14" height="14"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V17h5.2v-1.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z"/></svg>',
  puzzle:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" width="14" height="14"><path d="M9 4h4v2.2a1.8 1.8 0 1 0 0 3.6V12h4v4h-2.2a1.8 1.8 0 1 0 0 3.6V22H9v-4H6.8a1.8 1.8 0 1 0 0-3.6H9V12H4.8a1.8 1.8 0 1 1 0-3.6H9V4Z"/></svg>',
}

export function BackgroundTexture() {
  const items: Array<{ icon: string; top: string; left: string }> = [
    { icon: 'bulb', top: '6%', left: '6%' },
    { icon: 'star', top: '14%', left: '46%' },
    { icon: 'people', top: '78%', left: '80%' },
    { icon: 'puzzle', top: '34%', left: '90%' },
  ]
  return (
    <div className="bg-texture" aria-hidden="true">
      {items.map((it, i) => (
        <div
          key={i}
          className="bg-icon"
          style={{ top: it.top, left: it.left }}
          dangerouslySetInnerHTML={{ __html: ICONS[it.icon] }}
        />
      ))}
      <div className="bg-swirl" style={{ top: '48%', left: '47%' }} />
    </div>
  )
}

export function AvatarChip({
  avatarId,
  size = 'sm',
}: {
  avatarId: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const avatar = avatarById(avatarId)
  return (
    <span className={`avatar-chip ${size} bg-${avatar?.bg ?? 'green'}`} aria-hidden="true">
      {avatar?.emoji ?? '❓'}
    </span>
  )
}

export function BracketFrame({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string
  title: ReactNode
  children: ReactNode
}) {
  const tabs = [0, 1, 2, 3]
  const corners = ['tl', 'tr', 'bl', 'br']
  return (
    <div className="bracket-frame">
      <div className="bracket-tab">{tabs.map((i) => <span key={i} />)}</div>
      <div className="bracket-tab bottom">{tabs.map((i) => <span key={i} />)}</div>
      {corners.map((c) => (
        <div key={c} className={`corner-dots ${c}`}>
          {[0, 1, 2, 3, 4, 5].map((i) => <span key={i} />)}
        </div>
      ))}
      <div className="bracket-eyebrow">{eyebrow}</div>
      <div className="bracket-title">{title}</div>
      {children}
    </div>
  )
}

export function StatBox({ icon, label, value }: { icon: string; label: string; value: string | number }) {
  return (
    <div className="stat-box">
      <div className="stat-label">
        {ICONS[icon] ? (
          <span style={{ width: 14, height: 14, display: 'inline-flex' }} dangerouslySetInnerHTML={{ __html: ICONS[icon] }} />
        ) : null}
        {label}
      </div>
      <div className="stat-value">{value}</div>
    </div>
  )
}

export function TokenDots({ used, total = 3 }: { used: number; total?: number }) {
  return (
    <span className="token-dots">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`dot ${i < used ? 'dot-filled' : ''}`} />
      ))}
    </span>
  )
}

export function WishNote({
  wish,
  selected = false,
  selectable = false,
  onToggle,
}: {
  wish: Wish
  selected?: boolean
  selectable?: boolean
  onToggle?: (id: string) => void
}) {
  const cls = ['wish-note']
  if (selected) cls.push('wish-note-selected')
  return (
    <button
      type="button"
      className={cls.join(' ')}
      disabled={!selectable}
      aria-pressed={selected}
      onClick={selectable && onToggle ? () => onToggle(wish.id) : undefined}
    >
      <span className="wish-note-avatar">
        <AvatarChip avatarId={wish.avatarId} size="sm" />
      </span>
      <div>{wish.text}</div>
    </button>
  )
}

export function IdeaWall({
  wishes,
  selectedIds = [],
  selectable = false,
  onToggle,
}: {
  wishes: Wish[]
  selectedIds?: string[]
  selectable?: boolean
  onToggle?: (id: string) => void
}) {
  const sorted = [...wishes].sort((a, b) => a.createdAt - b.createdAt)
  return (
    <div className="idea-wall">
      {sorted.map((w) => (
        <WishNote
          key={w.id}
          wish={w}
          selectable={selectable}
          selected={selectedIds.includes(w.id)}
          onToggle={onToggle}
        />
      ))}
    </div>
  )
}

export function CollectiveCard({
  collective,
  wishes,
  rank,
  points,
  myTokens,
  showTokens = false,
  interactive = false,
  onAddToken,
  onRemoveToken,
}: {
  collective: CollectiveWish
  wishes: Wish[]
  rank?: number
  points?: number
  myTokens?: number
  showTokens?: boolean
  interactive?: boolean
  onAddToken?: (cid: string) => void
  onRemoveToken?: (cid: string) => void
}) {
  const members = wishes.filter((w) => w.collectiveId === collective.id)
  const used = myTokens ?? 0
  return (
    <div className={`collective-card ${rank === 1 ? 'top' : ''}`}>
      {rank !== undefined && <span className="rank-badge">#{rank}</span>}
      <h3 className="collective-title">{collective.title}</h3>
      <p className="collective-count">
        {members.length} {members.length === 1 ? 'wish' : 'wishes'}
      </p>
      <div className="collective-avatars">
        {members.slice(0, 6).map((w) => (
          <AvatarChip key={w.id} avatarId={w.avatarId} size="sm" />
        ))}
      </div>
      {points !== undefined && <p className="collective-points">{points} priority points</p>}
      {showTokens && (
        <div className="token-control">
          <TokenDots used={used} />
          <div className="token-buttons">
            <button
              type="button"
              className="token-btn"
              disabled={used === 0}
              aria-label={`Remove a priority from ${collective.title}`}
              onClick={() => onRemoveToken?.(collective.id)}
            >
              −
            </button>
            <button
              type="button"
              className="token-btn token-btn-add"
              disabled={!interactive}
              aria-label={`Add a priority to ${collective.title}`}
              onClick={() => onAddToken?.(collective.id)}
            >
              +
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export type { BgColor }
