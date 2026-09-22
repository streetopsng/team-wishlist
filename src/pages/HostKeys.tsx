import { useState } from 'react'
import { BackgroundTexture } from '@/components/ui'

export function HostKeys({
  code,
  hostKey,
  onContinue,
}: {
  code: string
  hostKey: string
  onContinue: () => void
}) {
  const [copied, setCopied] = useState<string | null>(null)
  const base = window.location.origin
  const hostUrl = `${base}/host/${code}?key=${hostKey}`
  const joinUrl = `${base}/s/${code}`

  async function copy(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      setCopied(null)
    }
  }

  return (
    <>
      <BackgroundTexture />
      <div className="screen">
        <div className="eyebrow">Session created</div>
        <h2 className="phase-title">Save your host link</h2>
        <p className="phase-prompt">
          This is the <strong>only</strong> time your host link is shown. Bookmark it — it is
          your control room on any device.
        </p>
        <div className="host-invite-row">
          <code>{hostUrl}</code>
          <button type="button" className="btn2 ghost" onClick={() => copy('host', hostUrl)}>
            {copied === 'host' ? 'Copied!' : 'Copy host link'}
          </button>
        </div>
        <div className="host-invite-row">
          <code>{joinUrl}</code>
          <button type="button" className="btn2 ghost" onClick={() => copy('join', joinUrl)}>
            {copied === 'join' ? 'Copied!' : 'Copy join link'}
          </button>
        </div>
        <p className="phase-instruction">
          Share the join link with your team through your own channel. Anyone with it can join
          anonymously — treat it like the room key.
        </p>
        <div className="wishing-footer">
          <button type="button" className="btn2 orange" onClick={onContinue}>
            Open control room
          </button>
        </div>
      </div>
    </>
  )
}
