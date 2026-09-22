import { BackgroundTexture } from '@/components/ui'

const DRIFT_WORDS = [
  { t: 'Imagine', top: '12%', left: '8%' },
  { t: 'Share', top: '18%', left: '78%' },
  { t: 'Find common ground', top: '38%', left: '4%' },
  { t: 'Prioritise', top: '70%', left: '82%' },
  { t: 'What do we want?', top: '80%', left: '10%' },
  { t: 'What matters most?', top: '46%', left: '84%' },
]

export function Landing({ onHost }: { onHost: () => void }) {
  return (
    <>
      <BackgroundTexture />
      <div className="landing">
        {DRIFT_WORDS.map((w) => (
          <div key={w.t} className="drift-word" style={{ top: w.top, left: w.left }}>
            {w.t}
          </div>
        ))}
        <div className="landing-content">
          <div className="eyebrow">Team Engagement</div>
          <h1 className="landing-title">
            Team
            <br />
            <span>Wishlist</span>
          </h1>
          <p className="landing-statement">
            If you could make one thing better at work, what would you wish for?
          </p>
          <div className="landing-actions">
            <button type="button" className="btn2 orange" onClick={onHost}>
              Host a session
            </button>
          </div>
          <p className="landing-footnote">
            A facilitated activity — not a survey, not a suggestion box.
          </p>
        </div>
      </div>
    </>
  )
}
