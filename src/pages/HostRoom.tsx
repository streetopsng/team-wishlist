import { useMemo, useState } from 'react'
import { BracketFrame, CollectiveCard, IdeaWall, StatBox } from '@/components/ui'
import {
  NEXT_PHASE,
  computeRanking,
  type CollectiveWish,
  type Participant,
  type Phase,
  type Wish,
} from '@/lib/domain'
import { saveCollective, setPhase, setRevealIndex } from '@/lib/session'
import type { SessionSnapshot } from '@/lib/session'

export function HostRoom({
  code,
  hostKey,
  snapshot,
}: {
  code: string
  hostKey: string
  snapshot: SessionSnapshot
}) {
  const phase = snapshot.meta.phase
  const participants = snapshot.participants
  const wishes = snapshot.wishes
  const collectives = snapshot.collectives
  const doneWishing = participants.filter((p) => p.doneWishing).length
  const doneAllocating = participants.filter((p) => p.doneAllocating).length

  const labels: Record<Phase, string> = {
    SETUP: 'Configuring session',
    WISHING: 'Making wishes',
    WAITING: 'Wishes closed',
    REVEAL: 'Wish pool revealed',
    MATCHING: 'Finding common ground',
    PRIORITISATION: 'Prioritising',
    RESULTS: 'Results',
    COMPLETE: 'Complete',
  }

  const header = (
    <BracketFrame
      eyebrow="Team Wishlist"
      title={
        <>
          {snapshot.meta.name} <span className="dot">•</span> {labels[phase]}
        </>
      }
    >
      <div className="stat-row">
        <StatBox icon="people" label="In room" value={phase === 'SETUP' ? 0 : participants.length} />
        <StatBox icon="star" label="Ready" value={doneWishing} />
        <StatBox icon="bulb" label="Wishes" value={wishes.length} />
        <StatBox icon="puzzle" label="Collective" value={collectives.length} />
      </div>
    </BracketFrame>
  )

  return (
    <div className="host-frame">
      {header}
      {phase === 'SETUP' && <HostSetup code={code} hostKey={hostKey} snapshot={snapshot} />}
      {phase === 'WISHING' && (
        <PhaseShell title="Wishes are open" prompt={`${wishes.length} wishes submitted so far.`}>
          <IdeaWall wishes={wishes.slice(-24)} />
        </PhaseShell>
      )}
      {phase === 'WAITING' && (
        <PhaseShell
          title="Wishes closed"
          prompt={`${doneWishing} / ${participants.length} people ready. ${wishes.length} wishes collected.`}
        />
      )}
      {phase === 'REVEAL' && (
        <PhaseShell title="Look what we're wishing for" prompt="Everyone brought something to the room.">
          <IdeaWall wishes={wishes} />
        </PhaseShell>
      )}
      {phase === 'MATCHING' && (
        <HostMatching code={code} hostKey={hostKey} wishes={wishes} collectives={collectives} />
      )}
      {phase === 'PRIORITISATION' && (
        <PhaseShell
          title="Team is prioritising"
          prompt={`${doneAllocating} / ${participants.length} participants complete.`}
        >
          <div className="collective-grid">
            {collectives.map((c) => (
              <CollectiveCard key={c.id} collective={c} wishes={wishes} />
            ))}
          </div>
        </PhaseShell>
      )}
      {phase === 'RESULTS' && (
        <HostResults code={code} hostKey={hostKey} snapshot={snapshot} collectives={collectives} participants={participants} />
      )}
      {phase === 'COMPLETE' && <HostComplete collectives={collectives} participants={participants} wishes={wishes} />}

      {NEXT_PHASE[phase] && (
        <div className="wishing-footer">
          <button
            type="button"
            className="btn2 orange"
            onClick={() => setPhase(code, hostKey, NEXT_PHASE[phase]!)}
          >
            {ADVANCE_LABELS[NEXT_PHASE[phase]!]}
          </button>
        </div>
      )}
    </div>
  )
}

const ADVANCE_LABELS: Record<Phase, string> = {
  WISHING: 'Launch session',
  WAITING: 'Close wishes',
  REVEAL: 'Reveal wishes',
  MATCHING: 'Start matching',
  PRIORITISATION: 'Start prioritisation',
  RESULTS: 'Reveal results',
  COMPLETE: 'End session',
  SETUP: '',
}

function PhaseShell({ title, prompt, children }: { title: string; prompt: string; children?: React.ReactNode }) {
  return (
    <div className="screen" style={{ padding: 0, maxWidth: 'none' }}>
      <h2 className="phase-title">{title}</h2>
      <p className="phase-prompt">{prompt}</p>
      {children}
    </div>
  )
}

function HostSetup({
  code,
  hostKey,
  snapshot,
}: {
  code: string
  hostKey: string
  snapshot: SessionSnapshot
}) {
  const joinUrl = `${window.location.origin}/s/${code}`
  return (
    <div className="screen" style={{ padding: 0, maxWidth: 'none' }}>
      <h2 className="phase-title">Ready to launch</h2>
      <p className="phase-prompt">
        “{snapshot.meta.name}” — share the join link with {snapshot.meta.invitedCount} people,
        then launch.
      </p>
      <div className="host-invite-row">
        <code>{joinUrl}</code>
        <button
          type="button"
          className="btn2 ghost"
          onClick={() => navigator.clipboard.writeText(joinUrl).catch(() => undefined)}
        >
          Copy join link
        </button>
      </div>
      <p className="config-note">
        Tip: keep this URL's <code>?key=</code> secret — whoever has it controls the session.
      </p>
      <button
        type="button"
        className="link-btn2"
        onClick={() => navigator.clipboard.writeText(hostKey).catch(() => undefined)}
      >
        Copy host key again
      </button>
    </div>
  )
}

function HostMatching({
  code,
  hostKey,
  wishes,
  collectives,
}: {
  code: string
  hostKey: string
  wishes: Wish[]
  collectives: CollectiveWish[]
}) {
  const [selected, setSelected] = useState<string[]>([])
  const [naming, setNaming] = useState(false)
  const [title, setTitle] = useState('')

  const unmatched = wishes.filter((w) => w.collectiveId === null)
  const selectedWishes = selected.map((id) => wishes.find((w) => w.id === id)).filter(Boolean) as Wish[]

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function save() {
    if (!title.trim() || selected.length === 0) return
    await saveCollective(code, hostKey, selected, title.trim())
    setSelected([])
    setNaming(false)
    setTitle('')
  }

  return (
    <div className="screen" style={{ padding: 0, maxWidth: 'none' }}>
      <h2 className="phase-title">Find the common ground</h2>
      <p className="phase-prompt">Some wishes may be asking for the same thing. Let's bring them together.</p>
      <p className="wall-caption">
        {collectives.length} collective {collectives.length === 1 ? 'wish' : 'wishes'} created ·{' '}
        {unmatched.length} wishes remaining
      </p>
      <IdeaWall wishes={unmatched} selectable selectedIds={selected} onToggle={toggle} />

      {selected.length > 0 && !naming && (
        <div className="match-bar">
          <span>
            {selected.length} {selected.length === 1 ? 'wish' : 'wishes'} selected
          </span>
          <span className="match-bar-question">Do these belong together?</span>
          <div className="match-bar-actions">
            <button type="button" className="btn2 ghost" onClick={() => setSelected([])}>
              Keep separate
            </button>
            <button
              type="button"
              className="btn2 orange"
              disabled={selected.length < 2}
              onClick={() => setNaming(true)}
            >
              Match
            </button>
          </div>
        </div>
      )}

      {naming && (
        <div className="naming-panel">
          <p className="naming-lead">
            {selected.length} independently wished for something like this.
          </p>
          <div className="naming-quotes">
            {selectedWishes.map((w) => (
              <div key={w.id} className="naming-quote">
                “{w.text}”
              </div>
            ))}
          </div>
          <input
            className="naming-input"
            placeholder="Name this collective wish…"
            aria-label="Collective wish title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="naming-actions">
            <button
              type="button"
              className="btn2 ghost"
              onClick={() => {
                setSelected([])
                setNaming(false)
                setTitle('')
              }}
            >
              Cancel
            </button>
            <button type="button" className="btn2 orange" disabled={!title.trim()} onClick={save}>
              Save collective wish
            </button>
          </div>
        </div>
      )}

      {collectives.length > 0 && (
        <div className="collective-strip">
          {collectives.map((c) => (
            <div key={c.id} className="mini-collective">
              <strong>{c.title}</strong>
              <span>
                {wishes.filter((w) => w.collectiveId === c.id).length}{' '}
                {wishes.filter((w) => w.collectiveId === c.id).length === 1 ? 'wish' : 'wishes'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function HostResults({
  code,
  hostKey,
  snapshot,
  collectives,
  participants,
}: {
  code: string
  hostKey: string
  snapshot: SessionSnapshot
  collectives: CollectiveWish[]
  participants: Participant[]
}) {
  const ranking = useMemo(() => computeRanking(collectives, participants), [collectives, participants])
  const idx = snapshot.revealIndex
  const n = ranking.length
  const done = idx >= n - 1
  const current = idx >= 0 ? ranking[n - 1 - idx] : null
  const shown = idx + 1

  return (
    <div className="screen" style={{ padding: 0, maxWidth: 'none' }}>
      <h2 className="phase-title">This is what we want</h2>
      <div className="results-layout">
        <div className="rankings-panel">
          <div className="rankings-title">Live rankings</div>
          {ranking.map((r) => {
            const filled = n - r.rank < shown
            return (
              <div key={r.collective.id} className={`rank-slot ${filled ? 'filled' : ''}`}>
                <span className="rank-slot-num">{r.rank}</span>
                <div className="rank-slot-body">
                  <span className="rank-slot-title">{filled ? r.collective.title : ''}</span>
                  {filled && <span className="rank-slot-points">{r.points} pts</span>}
                </div>
              </div>
            )
          })}
        </div>
        <div className="reveal-main">
          {current ? (
            <>
              <span className="reveal-tag">Rank</span>
              <div className="reveal-rank">#{current.rank}</div>
              <h3 className="reveal-title">{current.collective.title}</h3>
              <div className="reveal-points">{current.points} priority points</div>
            </>
          ) : (
            <p className="reveal-empty">Click "Reveal next" to start the countdown…</p>
          )}
        </div>
      </div>
      <p className="results-caption">
        {shown} of {n} revealed
      </p>
      <div className="wishing-footer">
        <button
          type="button"
          className="btn2 orange full"
          onClick={() =>
            done
              ? setPhase(code, hostKey, 'COMPLETE')
              : setRevealIndex(code, hostKey, Math.min(idx + 1, n - 1))
          }
        >
          {done ? 'End session' : 'Reveal next'}
        </button>
      </div>
    </div>
  )
}

function HostComplete({
  collectives,
  participants,
  wishes,
}: {
  collectives: CollectiveWish[]
  participants: Participant[]
  wishes: Wish[]
}) {
  const ranking = computeRanking(collectives, participants)
  const top = ranking[0]
  return (
    <div className="screen" style={{ padding: 0, maxWidth: 'none' }}>
      <h2 className="phase-title">Session results</h2>
      <div className="host-stats-grid">
        <div className="host-stat">
          <strong>{participants.length}</strong>
          <span>participants</span>
        </div>
        <div className="host-stat">
          <strong>{wishes.length}</strong>
          <span>individual wishes</span>
        </div>
        <div className="host-stat">
          <strong>{collectives.length}</strong>
          <span>collective wishes</span>
        </div>
      </div>
      {top && (
        <div className="top-priority-card">
          <span className="eyebrow" style={{ marginBottom: 2 }}>
            Top priority
          </span>
          <h3>{top.collective.title}</h3>
          <p>{top.points} priority points</p>
        </div>
      )}
      <div className="collective-grid">
        {ranking.map((r) => (
          <CollectiveCard
            key={r.collective.id}
            collective={r.collective}
            wishes={wishes}
            rank={r.rank}
            points={r.points}
          />
        ))}
      </div>
    </div>
  )
}
