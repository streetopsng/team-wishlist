import { useState } from 'react'
import { AvatarChip, BackgroundTexture } from '@/components/ui'
import { AVATARS, avatarById } from '@/lib/roster'
import { joinSession } from '@/lib/session'

export function Join({
  code,
  claimedAvatarIds,
  onJoined,
}: {
  code: string
  claimedAvatarIds: string[]
  onJoined: (pid: string, avatarId: string) => void
}) {
  const [picked, setPicked] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const claimed = new Set(claimedAvatarIds)
  const full = claimed.size >= AVATARS.length
  const pickedAvatar = picked ? avatarById(picked) : null

  async function confirm() {
    if (!picked) return
    setBusy(true)
    setError(null)
    try {
      const { pid } = await joinSession(code, picked)
      onJoined(pid, picked)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Join failed')
      setBusy(false)
    }
  }

  return (
    <>
      <BackgroundTexture />
      <div className="screen center-screen">
        <div className="eyebrow">Team Wishlist</div>
        <h2 className="section-title">You're joining anonymously.</h2>
        <p className="section-sub">No names. Just your wishes.</p>
        {full ? (
          <p className="section-sub">The room is full — every avatar is taken.</p>
        ) : (
          <>
            <div className="avatar-grid2" role="group" aria-label="Choose your avatar">
              {AVATARS.map((a) => {
                const taken = claimed.has(a.id)
                return (
                  <button
                    key={a.id}
                    type="button"
                    className={`avatar-cell bg-${a.bg} ${picked === a.id ? 'selected' : ''} ${taken ? 'taken' : ''}`}
                    disabled={taken || busy}
                    aria-pressed={picked === a.id}
                    aria-label={`Choose avatar ${a.emoji}`}
                    onClick={() => setPicked(a.id)}
                  >
                    {a.emoji}
                  </button>
                )
              })}
            </div>
            <div className="avatar-confirm-row">
              {pickedAvatar ? (
                <>
                  <AvatarChip avatarId={pickedAvatar.id} size="md" />
                  <button type="button" className="btn2 orange" disabled={busy} onClick={confirm}>
                    {busy ? 'Joining…' : 'Confirm selection'}
                  </button>
                  <button type="button" className="link-btn2" onClick={() => setPicked(null)}>
                    Cancel
                  </button>
                </>
              ) : (
                <p className="section-sub" style={{ margin: 0 }}>
                  Pick an avatar to continue.
                </p>
              )}
            </div>
            {error && <p style={{ color: 'var(--orange-deep)', fontWeight: 700 }}>{error}</p>}
          </>
        )}
      </div>
    </>
  )
}
