import { useEffect, useRef } from 'react'
import { Icon } from '@/components/ui'

export function EndSessionModal({
  busy,
  onCancel,
  onConfirm,
}: {
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onCancel])

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel()
      }}
    >
      <div className="modal-panel" role="alertdialog" aria-modal="true" aria-labelledby="end-title" aria-describedby="end-desc">
        <div className="modal-icon danger">
          <Icon name="logout" size={22} />
        </div>
        <h3 id="end-title" className="modal-title">End this session?</h3>
        <p id="end-desc" className="modal-body">
          Everyone in the room will see that the session has ended, and it will close in GummyGum.
          This can&apos;t be undone.
        </p>
        <div className="modal-actions">
          <button ref={cancelRef} type="button" className="btn-plain" disabled={busy} onClick={onCancel}>
            Keep session
          </button>
          <button type="button" className="btn-danger" disabled={busy} onClick={onConfirm}>
            {busy ? 'Ending...' : 'End session'}
          </button>
        </div>
      </div>
    </div>
  )
}
