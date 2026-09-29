import { useState } from 'react'
import { AvatarChip, Icon } from '@/components/ui'
import { AVATAR_IDS, avatarLabel, avatarUrl } from '@/lib/roster'
import { joinSession } from '@/lib/session'

export function Join({
  code,
  claimedAvatarIds,
  playerName,
  onJoined,
}: {
  code: string
  claimedAvatarIds: string[]
  playerName: string | null
  onJoined: (pid: string, avatarId: string) => void
}) {
  const [picked, setPicked] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const claimed = new Set(claimedAvatarIds)
  const full = AVATAR_IDS.every((id) => claimed.has(id))
  const pickedAvailable = picked !== null && !claimed.has(picked)

  async function confirm() {
    if (!picked || !pickedAvailable) return
    setBusy(true)
    setError(null)
    try {
      const { pid } = await joinSession(code, picked)
      onJoined(pid, picked)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Join failed')
      setPicked(null)
      setBusy(false)
    }
  }

  return (
    <div className="join-page">
      <div className="screen join-screen">
        <div className="eyebrow">Team Wishlist</div>
        <h2 className="section-title">Pick your avatar</h2>
        <p className="section-sub">
          Your wishes are anonymous. The room only sees your avatar, never your name.
        </p>

        {playerName && (
          <div className="field-readonly" aria-label="Your name">
            <span className="field-readonly-label">Joining as</span>
            <span className="field-readonly-value">
              <Icon name="user" size={16} />
              {playerName}
            </span>
            <span className="field-readonly-hint">Set by GummyGum</span>
          </div>
        )}

        {full ? (
          <p className="section-sub">The room is full. Every avatar is taken.</p>
        ) : (
          <div className="avatar-grid2" role="group" aria-label="Choose your avatar">
            {AVATAR_IDS.map((id) => {
              const taken = claimed.has(id)
              const selected = picked === id
              return (
                <button
                  key={id}
                  type="button"
                  className={`avatar-cell ${selected ? 'selected' : ''} ${taken ? 'taken' : ''}`}
                  disabled={taken || busy}
                  aria-pressed={selected}
                  aria-label={taken ? `${avatarLabel(id)} (taken)` : avatarLabel(id)}
                  onClick={() => setPicked(id)}
                >
                  <img src={avatarUrl(id)} alt="" draggable={false} />
                  {selected && (
                    <span className="avatar-cell-check">
                      <Icon name="check" size={12} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
        {error && <p className="form-error">{error}</p>}
      </div>

      {!full && (
        <div className="sticky-cta">
          <div className="sticky-cta-inner">
            {pickedAvailable && picked && <AvatarChip avatarId={picked} size="md" />}
            <button
              type="button"
              className="btn2 orange sticky-cta-btn"
              disabled={!pickedAvailable || busy}
              onClick={confirm}
            >
              {busy ? 'Joining...' : 'Enter the room'}
              <Icon name="arrowRight" size={16} />
            </button>
          </div>
          <p className="sticky-cta-hint">{pickedAvailable ? 'Looking good.' : 'Pick an avatar to continue.'}</p>
        </div>
      )}
    </div>
  )
}
