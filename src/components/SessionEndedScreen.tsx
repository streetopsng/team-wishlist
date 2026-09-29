import { returnToGummyGum } from '@/lib/gummygumSession'

export function SessionEndedScreen({ isHost, hubUrl }: { isHost: boolean; hubUrl: string }) {
  return (
    <div className="screen center-screen">
      <h2 className="section-title">Session ended</h2>
      <p className="section-sub">
        {isHost ? 'This session has ended. Returning you to GummyGum...' : 'The host ended this session. You can close this tab now.'}
      </p>
      {isHost && (
        <button type="button" className="btn2 orange" style={{ marginTop: 18 }} onClick={() => returnToGummyGum(hubUrl)}>
          Back to GummyGum
        </button>
      )}
    </div>
  )
}
