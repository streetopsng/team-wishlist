import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { AvatarChip, CollectiveCard, Icon, IdeaWall } from '@/components/ui'
import { EndSessionModal } from '@/components/EndSessionModal'
import {
  MAX_WISHES,
  NEXT_PHASE,
  autoPromote,
  computeRanking,
  type CollectiveWish,
  type Participant,
  type Phase,
  type Wish,
} from '@/lib/domain'
import { applyAutoPromotion, markSessionEnded, saveCollective, setPhase, setRevealIndex } from '@/lib/session'
import type { SessionSnapshot } from '@/lib/session'
import { exportResults } from '@/lib/export'
import { reportGummyGumCancel, reportGummyGumResult, returnToGummyGum, type GummyGumLaunchSession } from '@/lib/gummygumSession'

const PHASE_LABELS: Record<Phase, string> = {
  SETUP: 'Lobby',
  WISHING: 'Wishes open',
  WAITING: 'Wishes closed',
  REVEAL: 'Wish pool revealed',
  MATCHING: 'Finding common ground',
  PRIORITISATION: 'Prioritising',
  RESULTS: 'Results',
  COMPLETE: 'Complete',
}

const ADVANCE_LABELS: Partial<Record<Phase, string>> = {
  WISHING: 'Open wishes',
  WAITING: 'Close wishes',
  REVEAL: 'Reveal wishes',
  MATCHING: 'Start matching',
  PRIORITISATION: 'Start prioritisation',
  RESULTS: 'Reveal results',
  COMPLETE: 'Finish session',
}

const MIN_PARTICIPANTS = 2

const STEPS: Array<{ label: string; phases: Phase[] }> = [
  { label: 'Lobby', phases: ['SETUP'] },
  { label: 'Wishing', phases: ['WISHING', 'WAITING'] },
  { label: 'Reveal', phases: ['REVEAL'] },
  { label: 'Matching', phases: ['MATCHING'] },
  { label: 'Prioritising', phases: ['PRIORITISATION'] },
  { label: 'Results', phases: ['RESULTS', 'COMPLETE'] },
]

export function HostRoom({
  code,
  hostKey,
  snapshot,
  ggSession,
}: {
  code: string
  hostKey: string
  snapshot: SessionSnapshot
  ggSession: GummyGumLaunchSession | null
}) {
  const phase = snapshot.meta.phase
  const participants = snapshot.participants
  const wishes = snapshot.wishes
  const collectives = snapshot.collectives
  const doneWishing = participants.filter((p) => p.doneWishing).length
  const doneAllocating = participants.filter((p) => p.doneAllocating).length
  const ranking = useMemo(() => computeRanking(collectives, participants), [collectives, participants])
  const [endOpen, setEndOpen] = useState(false)
  const [ending, setEnding] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  async function run(action: () => Promise<void>) {
    setAdvancing(true)
    setActionError(null)
    try {
      await action()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Something went wrong, try again')
    } finally {
      setAdvancing(false)
    }
  }

  async function advance(next: Phase): Promise<void> {
    if (phase === 'MATCHING' && next === 'PRIORITISATION') {
      const ungrouped = wishes.filter((w) => w.collectiveId === null)
      if (ungrouped.length > 0) {
        const result = autoPromote(wishes, collectives)
        await applyAutoPromotion(code, hostKey, result.collectives, result.assignments)
      }
    }
    await setPhase(code, hostKey, next)
    // Reported after the room is COMPLETE: the report ends the hub session, and clients must see the final phase first.
    if (next === 'COMPLETE' && ggSession?.isHost) {
      void reportGummyGumResult({
        name: ggSession.player?.name || 'Host',
        score: participants.length,
        wishCount: wishes.length,
        collectiveCount: collectives.length,
        topPriority: ranking[0]?.collective.title ?? null,
      })
    }
  }

  const closeEnd = useCallback(() => setEndOpen(false), [])

  async function endSession() {
    setEnding(true)
    // keepalive lets the cancel report finish even though ending the room navigates away.
    if (ggSession?.isHost) void reportGummyGumCancel()
    await markSessionEnded(code, hostKey).catch(() => undefined)
    returnToGummyGum(ggSession?.hubUrl)
  }

  const next = NEXT_PHASE[phase]
  const joined = participants.length
  const online = participants.filter((p) => p.online).length

  let status: ReactNode = null
  let primary: ReactNode = null
  let secondary: ReactNode = null

  if (phase === 'SETUP') {
    status = joined < MIN_PARTICIPANTS
      ? `Waiting for at least ${MIN_PARTICIPANTS} participants (${joined} joined)`
      : `${joined} people in the room`
  } else if (phase === 'WISHING') {
    status = `${doneWishing} of ${joined} done, ${wishes.length} ${wishes.length === 1 ? 'wish' : 'wishes'}`
  } else if (phase === 'WAITING') {
    status = `${wishes.length} ${wishes.length === 1 ? 'wish' : 'wishes'} collected`
  } else if (phase === 'MATCHING') {
    const left = wishes.filter((w) => w.collectiveId === null).length
    status = `${collectives.length} collective, ${left} unmatched`
  } else if (phase === 'PRIORITISATION') {
    status = `${doneAllocating} of ${joined} prioritised`
  }

  if (phase === 'RESULTS') {
    const n = ranking.length
    const idx = snapshot.revealIndex
    const done = idx >= n - 1
    status = `${Math.min(idx + 1, n)} of ${n} revealed`
    primary = (
      <button
        type="button"
        className="btn2 orange"
        disabled={advancing}
        onClick={() => run(() => (done ? advance('COMPLETE') : setRevealIndex(code, hostKey, Math.min(idx + 1, n - 1))))}
      >
        {done ? ADVANCE_LABELS.COMPLETE : 'Reveal next'}
      </button>
    )
    secondary = (
      <button type="button" className="btn-plain" onClick={() => exportResults(code, snapshot.meta.name, ranking, wishes)}>
        Download CSV
      </button>
    )
  } else if (phase === 'COMPLETE') {
    status = 'Results saved'
    secondary = (
      <button type="button" className="btn-plain" onClick={() => exportResults(code, snapshot.meta.name, ranking, wishes)}>
        Download CSV
      </button>
    )
    if (ggSession) {
      primary = (
        <button type="button" className="btn2 orange" onClick={() => returnToGummyGum(ggSession.hubUrl)}>
          Back to GummyGum
        </button>
      )
    }
  } else if (next) {
    const blocked = phase === 'SETUP' && joined < MIN_PARTICIPANTS
    primary = (
      <button type="button" className="btn2 orange" disabled={advancing || blocked} onClick={() => run(() => advance(next))}>
        {ADVANCE_LABELS[next]}
      </button>
    )
  }

  const stepIndex = STEPS.findIndex((s) => s.phases.includes(phase))

  return (
    <div className="host-shell">
      <header className="host-topbar">
        <div className="host-topbar-title">
          <span className="host-topbar-eyebrow">Team Wishlist</span>
          <h1>{snapshot.meta.name}</h1>
        </div>
        <div className="host-topbar-actions">
          <span className="phase-badge">{PHASE_LABELS[phase]}</span>
          {phase !== 'COMPLETE' && (
            <button type="button" className="btn-end" onClick={() => setEndOpen(true)}>
              <Icon name="logout" size={15} />
              End session
            </button>
          )}
        </div>
      </header>

      <ol className="host-steps" aria-label="Session progress">
        {STEPS.map((s, i) => {
          const state = phase === 'COMPLETE' || i < stepIndex ? 'done' : i === stepIndex ? 'current' : 'todo'
          return (
            <li key={s.label} className={`host-step ${state}`} aria-current={state === 'current' ? 'step' : undefined}>
              <span className="host-step-bar" />
              <span className="host-step-label">{s.label}</span>
            </li>
          )
        })}
      </ol>

      <main className="host-body">
        {phase === 'SETUP' && (
          <HostLobby snapshot={snapshot} online={online} />
        )}
        {(phase === 'WISHING' || phase === 'WAITING') && (
          <SplitLayout
            aside={
              <RosterPanel
                title="In the room"
                meta={`${doneWishing} of ${joined} done`}
                participants={participants}
                statusFor={(p) => {
                  if (p.doneWishing) return { text: 'Done', tone: 'done' }
                  const count = wishes.filter((w) => w.authorPid === p.pid).length
                  return { text: `${count} of ${MAX_WISHES} wishes`, tone: count > 0 ? 'active' : 'idle' }
                }}
              />
            }
          >
            <Panel
              title={phase === 'WISHING' ? 'Incoming wishes' : 'Wishes closed'}
              meta={`${wishes.length} ${wishes.length === 1 ? 'wish' : 'wishes'}`}
            >
              {wishes.length === 0 ? (
                <EmptyState text="Wishes will appear here the moment they are submitted." />
              ) : (
                <IdeaWall wishes={wishes} />
              )}
            </Panel>
          </SplitLayout>
        )}
        {phase === 'REVEAL' && (
          <Panel title="Look what we're wishing for" meta={`${wishes.length} wishes from ${joined} people`}>
            <IdeaWall wishes={wishes} />
          </Panel>
        )}
        {phase === 'MATCHING' && (
          <HostMatching code={code} hostKey={hostKey} wishes={wishes} collectives={collectives} />
        )}
        {phase === 'PRIORITISATION' && (
          <SplitLayout
            aside={
              <RosterPanel
                title="Prioritising"
                meta={`${doneAllocating} of ${joined} done`}
                participants={participants}
                statusFor={(p) =>
                  p.doneAllocating ? { text: 'Done', tone: 'done' } : { text: 'Choosing', tone: 'active' }
                }
              />
            }
          >
            <Panel title="Collective wishes" meta={`${collectives.length} to prioritise`}>
              <div className="collective-grid">
                {collectives.map((c) => (
                  <CollectiveCard key={c.id} collective={c} wishes={wishes} />
                ))}
              </div>
            </Panel>
          </SplitLayout>
        )}
        {phase === 'RESULTS' && <HostResults ranking={ranking} revealIndex={snapshot.revealIndex} />}
        {phase === 'COMPLETE' && (
          <HostComplete ranking={ranking} participants={participants} wishes={wishes} collectives={collectives} />
        )}
      </main>

      {(primary || secondary || status) && (
        <footer className="host-actionbar">
          <div className="host-actionbar-inner">
            <div className="host-actionbar-status">
              {status}
              {actionError && <span className="form-error">{actionError}</span>}
            </div>
            <div className="host-actionbar-buttons">
              {secondary}
              {primary}
            </div>
          </div>
        </footer>
      )}

      {endOpen && <EndSessionModal busy={ending} onCancel={closeEnd} onConfirm={endSession} />}
    </div>
  )
}

function Panel({ title, meta, children }: { title: string; meta?: string; children: ReactNode }) {
  return (
    <section className="host-panel">
      <div className="host-panel-head">
        <h2>{title}</h2>
        {meta && <span className="host-panel-meta">{meta}</span>}
      </div>
      {children}
    </section>
  )
}

function SplitLayout({ aside, children }: { aside: ReactNode; children: ReactNode }) {
  return (
    <div className="host-split">
      <div className="host-split-main">{children}</div>
      <div className="host-split-aside">{aside}</div>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return <p className="host-empty">{text}</p>
}

type Tone = 'done' | 'active' | 'idle'

function RosterPanel({
  title,
  meta,
  participants,
  statusFor,
}: {
  title: string
  meta: string
  participants: Participant[]
  statusFor?: (p: Participant) => { text: string; tone: Tone }
}) {
  return (
    <Panel title={title} meta={meta}>
      <RosterList participants={participants} statusFor={statusFor} />
    </Panel>
  )
}

function RosterList({
  participants,
  statusFor,
}: {
  participants: Participant[]
  statusFor?: (p: Participant) => { text: string; tone: Tone }
}) {
  const sorted = [...participants].sort((a, b) => a.joinedAt - b.joinedAt)
  if (sorted.length === 0) {
    return <EmptyState text="Nobody here yet. People appear the moment they pick an avatar." />
  }
  return (
    <ul className="roster">
      {sorted.map((p) => {
        const s = statusFor?.(p)
        return (
          <li key={p.pid} className={`roster-item ${p.online ? '' : 'away'}`}>
            <span className="roster-avatar">
              <AvatarChip avatarId={p.avatarId} size="md" />
              <span className={`presence-dot ${p.online ? 'on' : 'off'}`} aria-label={p.online ? 'Online' : 'Away'} />
            </span>
            <span className={`roster-status ${p.online ? s?.tone ?? '' : ''}`}>
              {p.online && s?.tone === 'done' && <Icon name="check" size={12} />}
              {p.online ? s?.text ?? 'Joined' : 'Away'}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function HostLobby({ snapshot, online }: { snapshot: SessionSnapshot; online: number }) {
  const joined = snapshot.participants.length
  const invited = snapshot.meta.invitedCount
  const pct = invited > 0 ? Math.min(100, Math.round((joined / invited) * 100)) : 0

  return (
    <div className="host-split lobby">
      <div className="host-split-main">
        <section className="host-panel">
          <div className="host-panel-head">
            <h2>Waiting room</h2>
            <span className="host-panel-meta">{online} online</span>
          </div>
          <div className="lobby-count">
            <span className="lobby-count-num">{joined}</span>
            <span className="lobby-count-of">{invited > 0 ? `of ${invited} invited have joined` : 'joined'}</span>
          </div>
          {invited > 0 && (
            <div className="lobby-progress" aria-hidden="true">
              <div className="lobby-progress-fill" style={{ width: `${pct}%` }} />
            </div>
          )}
          <RosterList participants={snapshot.participants} />
        </section>
      </div>
      <div className="host-split-aside">
        <section className="host-panel">
          <div className="host-panel-head">
            <h2>How it runs</h2>
          </div>
          <ol className="lobby-steps">
            <li><strong>Wish</strong> Everyone adds up to {MAX_WISHES} anonymous wishes.</li>
            <li><strong>Reveal</strong> You show the whole wish pool to the room.</li>
            <li><strong>Match</strong> You group wishes that ask for the same thing.</li>
            <li><strong>Prioritise</strong> Everyone spends 3 priorities.</li>
            <li><strong>Results</strong> You reveal the ranking, lowest to highest.</li>
          </ol>
        </section>
      </div>
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
    <Panel title="Find the common ground" meta={`${unmatched.length} wishes remaining`}>
      <p className="host-panel-lead">Select wishes that ask for the same thing, then name them as one collective wish.</p>
      <IdeaWall wishes={unmatched} selectable selectedIds={selected} onToggle={toggle} />

      {selected.length > 0 && !naming && (
        <div className="match-bar">
          <span>
            {selected.length} {selected.length === 1 ? 'wish' : 'wishes'} selected
          </span>
          <span className="match-bar-question">Do these belong together?</span>
          <div className="match-bar-actions">
            <button type="button" className="btn-plain" onClick={() => setSelected([])}>
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
                &ldquo;{w.text}&rdquo;
              </div>
            ))}
          </div>
          <input
            className="naming-input"
            placeholder="Name this collective wish"
            aria-label="Collective wish title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="naming-actions">
            <button
              type="button"
              className="btn-plain"
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
          {collectives.map((c) => {
            const count = wishes.filter((w) => w.collectiveId === c.id).length
            return (
              <div key={c.id} className="mini-collective">
                <strong>{c.title}</strong>
                <span>
                  {count} {count === 1 ? 'wish' : 'wishes'}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </Panel>
  )
}

function HostResults({
  ranking,
  revealIndex,
}: {
  ranking: ReturnType<typeof computeRanking>
  revealIndex: number
}) {
  const n = ranking.length
  const current = revealIndex >= 0 ? ranking[n - 1 - revealIndex] : null
  const shown = revealIndex + 1

  return (
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
          <p className="reveal-empty">Press Reveal next to start the countdown.</p>
        )}
      </div>
    </div>
  )
}

function HostComplete({
  ranking,
  participants,
  wishes,
  collectives,
}: {
  ranking: ReturnType<typeof computeRanking>
  participants: Participant[]
  wishes: Wish[]
  collectives: CollectiveWish[]
}) {
  const top = ranking[0]
  return (
    <Panel title="Session results">
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
    </Panel>
  )
}
