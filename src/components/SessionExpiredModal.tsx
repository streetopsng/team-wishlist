import { reportGummyGumCancel } from '@/lib/gummygumSession'

export function SessionExpiredModal({
  isHost,
  context,
  hubUrl,
}: {
  isHost: boolean
  context: 'lobby' | 'game'
  hubUrl: string | null
}) {
  const message =
    context === 'game'
      ? isHost
        ? 'This session was abandoned mid-session with nobody connected for several hours, so it has been ended. You can return to GummyGum to launch a fresh session.'
        : 'This session was ended after being abandoned for several hours. Thank you for being here. You can safely close this tab now.'
      : isHost
        ? 'This session was inactive in the lobby for more than 20 minutes and has expired. You can return to GummyGum to launch a fresh session.'
        : 'This session has expired due to inactivity. Thank you for being here. You can safely close this tab now.'

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(36,25,52,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        style={{ background: 'var(--panel)', border: '2.5px solid var(--line)', borderRadius: 20, boxShadow: '6px 6px 0 var(--line)', padding: 24, maxWidth: 360, width: '100%', textAlign: 'center' }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="36" height="36" style={{ color: 'var(--orange-deep)', marginBottom: 8 }} aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
        <h3 className="phase-title" style={{ fontSize: 18 }}>Session Expired</h3>
        <p className="phase-prompt">{message}</p>
        {isHost ? (
          <button
            type="button"
            className="btn2 orange full"
            style={{ marginTop: 16 }}
            onClick={async () => {
              await reportGummyGumCancel()
              window.location.href = hubUrl || 'https://gummygum.app'
            }}
          >
            Return to GummyGum to Rehost
          </button>
        ) : (
          <button
            type="button"
            className="btn2 ghost full"
            style={{ marginTop: 16 }}
            onClick={() => {
              try {
                window.close()
              } catch {
                // ignore
              }
            }}
          >
            Close Tab
          </button>
        )}
      </div>
    </div>
  )
}
