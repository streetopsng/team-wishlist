import { useState } from 'react'
import { BackgroundTexture } from '@/components/ui'
import { createSession } from '@/lib/session'

export function HostCreate({ onCreated }: { onCreated: (code: string, hostKey: string) => void }) {
  const [name, setName] = useState('Team Wishlist — Q1 Check-in')
  const [invited, setInvited] = useState(24)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    setBusy(true)
    setError(null)
    try {
      const { code, hostKey } = await createSession(name.trim() || 'Team Wishlist', invited)
      onCreated(code, hostKey)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setBusy(false)
    }
  }

  return (
    <>
      <BackgroundTexture />
      <div className="screen">
        <p className="config-note">
          Participants, schedule and reminders live with your invite tool — here you set up the
          room itself.
        </p>
        <h2 className="phase-title">Set up your session</h2>
        <p className="phase-prompt">Give it a name and tell us how many people to expect.</p>
        <div style={{ margin: '22px 0 20px' }}>
          <label
            htmlFor="sessionName"
            style={{
              display: 'block',
              fontSize: 11.5,
              fontWeight: 700,
              color: 'var(--muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 7,
            }}
          >
            Session name
          </label>
          <input
            id="sessionName"
            className="wish-input"
            style={{ minHeight: 'auto', padding: '13px 15px' }}
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div style={{ margin: '0 0 20px' }}>
          <label
            htmlFor="invitedCount"
            style={{
              display: 'block',
              fontSize: 11.5,
              fontWeight: 700,
              color: 'var(--muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 7,
            }}
          >
            Expected people (informational — the room holds up to 30)
          </label>
          <input
            id="invitedCount"
            type="number"
            min={1}
            max={30}
            className="wish-input"
            style={{ minHeight: 'auto', padding: '13px 15px', maxWidth: 160 }}
            value={invited}
            onChange={(e) => setInvited(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
          />
        </div>
        {error && <p style={{ color: 'var(--orange-deep)', fontWeight: 700 }}>{error}</p>}
        <div className="wishing-footer">
          <button type="button" className="btn2 orange" disabled={busy} onClick={handleCreate}>
            {busy ? 'Creating…' : 'Create session'}
          </button>
        </div>
      </div>
    </>
  )
}
