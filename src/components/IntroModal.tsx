import { useEffect, useRef } from 'react'
import { Icon } from '@/components/ui'
import { MAX_WISHES } from '@/lib/domain'

const STEPS: [string, string][] = [
  ['Make your wishes', `Add up to ${MAX_WISHES} things you would love to see, have, change or improve at work. One idea per wish.`],
  ['See the wish pool', 'Every wish is revealed together, anonymously. The room only ever sees your avatar.'],
  ['Find the common ground', 'Your host groups wishes that ask for the same thing into shared team wishes.'],
  ['Choose what matters most', 'Spend your 3 priorities on the wishes you care about, then see the team wishlist revealed.'],
]

export function IntroModal({ playerName, onConfirm }: { playerName: string | null; onConfirm: () => void }) {
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    confirmRef.current?.focus()
  }, [])

  return (
    <div className="modal-backdrop">
      <div className="modal-panel intro-panel" role="dialog" aria-modal="true" aria-labelledby="intro-title">
        <div className="intro-head">
          <span className="phase-badge">About this experience</span>
          <h3 id="intro-title" className="modal-title intro-title">How Team Wishlist works</h3>
          <p className="modal-body intro-body">
            Welcome{playerName ? `, ${playerName}` : ''}! Together the team builds a shared wishlist of what would make work
            better, and decides what matters most.
          </p>
        </div>
        <ol className="intro-steps">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="intro-step">
              <span className="intro-step-num">{i + 1}</span>
              <div>
                <div className="intro-step-title">{title}</div>
                <div className="intro-step-body">{body}</div>
              </div>
            </li>
          ))}
        </ol>
        <button ref={confirmRef} type="button" className="btn2 orange full intro-cta" onClick={onConfirm}>
          Got it, enter the room
          <Icon name="arrowRight" size={16} />
        </button>
      </div>
    </div>
  )
}
