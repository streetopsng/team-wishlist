import { useMemo, useState } from 'react'
import { AvatarChip, CollectiveCard, IdeaWall, TokenDots } from '@/components/ui'
import {
  MAX_WISHES,
  TOKENS_PER_PARTICIPANT,
  WISH_MAX_LENGTH,
  canAddToken,
  computeRanking,
  isValidWishText,
  totalTokens,
  type CollectiveWish,
  type Participant,
  type Wish,
  isRevealComplete,
} from '@/lib/domain'
import { markDone, setTokens, submitWish } from '@/lib/session'
import type { SessionSnapshot } from '@/lib/session'

function WaitingRoom({
  headline,
  sub,
  ready,
  total,
}: {
  headline: string
  sub: string
  ready: number
  total: number
}) {
  return (
    <div className="screen center-screen">
      <h2 className="section-title">{headline}</h2>
      <p className="section-sub">{sub}</p>
      <div className="ready-count">
        {ready} / {total} people ready
      </div>
      <div className="ready-bar">
        <div className="ready-bar-fill" style={{ width: `${total ? (ready / total) * 100 : 0}%` }} />
      </div>
    </div>
  )
}

export function ParticipantRoom({
  code,
  snapshot,
  me,
}: {
  code: string
  snapshot: SessionSnapshot
  me: Participant
}) {
  const phase = snapshot.meta.phase
  const wishes = snapshot.wishes
  const collectives = snapshot.collectives
  const participants = snapshot.participants
  const myWishes = wishes.filter((w) => w.authorPid === me.pid)
  const doneCount = participants.filter((p) => p.doneWishing).length

  return (
    <>
      {phase === 'SETUP' && (
        <div className="screen center-screen">
          <h2 className="section-title">Getting ready…</h2>
          <p className="section-sub">Your host will open wishes shortly.</p>
        </div>
      )}

      {(phase === 'WISHING' || phase === 'WAITING') && (
        <ParticipantWishing
          code={code}
          me={me}
          myWishes={myWishes}
          participantCount={participants.length}
          doneCount={doneCount}
          closed={phase === 'WAITING'}
        />
      )}

      {phase === 'REVEAL' && (
        <div className="screen">
          <header className="room-header">
            <div className="eyebrow" style={{ margin: 0 }}>
              Team Wishlist
            </div>
            <span className="phase-badge">Wish pool revealed</span>
          </header>
          <h2 className="phase-title">Look what we're wishing for</h2>
          <p className="phase-prompt">Everyone brought something to the room.</p>
          <IdeaWall wishes={wishes} />
        </div>
      )}

      {phase === 'MATCHING' && (
        <div className="screen">
          <header className="room-header">
            <div className="eyebrow" style={{ margin: 0 }}>
              Team Wishlist
            </div>
            <span className="phase-badge">Finding common ground</span>
          </header>
          <h2 className="phase-title">Find the common ground</h2>
          <p className="phase-prompt">
            Some wishes may be asking for the same thing. Your host is bringing them together.
          </p>
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
          <p className="wall-caption">
            {wishes.filter((w) => w.collectiveId === null).length} wishes still in the pool
          </p>
          <IdeaWall wishes={wishes.filter((w) => w.collectiveId === null)} />
        </div>
      )}

      {phase === 'PRIORITISATION' && (
        <ParticipantPrioritisation code={code} me={me} collectives={collectives} wishes={wishes} participants={participants} />
      )}

      {phase === 'RESULTS' && (
        <ParticipantResults code={code} snapshot={snapshot} me={me} collectives={collectives} participants={participants} />
      )}

      {phase === 'COMPLETE' && (
        <ParticipantFinal collectives={collectives} participants={participants} />
      )}
    </>
  )
}

function ParticipantWishing({
  code,
  me,
  myWishes,
  participantCount,
  doneCount,
  closed,
}: {
  code: string
  me: Participant
  myWishes: { text: string }[]
  participantCount: number
  doneCount: number
  closed: boolean
}) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const remaining = MAX_WISHES - myWishes.length
  const full = remaining <= 0

  if (me.doneWishing || closed) {
    return (
      <WaitingRoom
        headline="Your wishes are in."
        sub="We're waiting for the room."
        ready={doneCount}
        total={Math.max(participantCount, 1)}
      />
    )
  }

  async function add() {
    if (!isValidWishText(text)) {
      setError('Wishes need 1–90 characters')
      return
    }
    try {
      await submitWish(code, me, text, myWishes.length)
      setText('')
      setError(null)
    } catch {
      setError('Could not submit — check your connection')
    }
  }

  return (
    <div className="screen">
      <header className="room-header">
        <div className="eyebrow" style={{ margin: 0 }}>
          Team Wishlist
        </div>
        <span className="room-count">{participantCount} people in the room</span>
      </header>
      <h2 className="phase-title">Make your wishes</h2>
      <p className="phase-prompt">What would you love to see, have, change or improve at work?</p>
      <p className="phase-instruction">One idea per wish.</p>
      <div className="wish-counter">
        {remaining > 0 ? `You have ${remaining} ${remaining === 1 ? 'wish' : 'wishes'} left` : "You've used all 5 wishes"}
      </div>
      <div className="wish-input-row">
        <textarea
          className="wish-input"
          placeholder="Write your wish…"
          maxLength={WISH_MAX_LENGTH}
          disabled={full}
          aria-label="Write your wish"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="button" className="btn2 orange" disabled={full} onClick={add}>
          Add wish
        </button>
      </div>
      <div className="your-wishes" aria-label="Your wishes so far">
        {myWishes.map((w, i) => (
          <div key={i} className="your-wish-row">
            <span className="check">✓</span> {w.text}
          </div>
        ))}
      </div>
      {error && <p style={{ color: 'var(--orange-deep)', fontWeight: 700 }}>{error}</p>}
      <div className="wishing-footer">
        <button
          type="button"
          className="btn2 ghost full"
          disabled={myWishes.length === 0}
          onClick={() => markDone(code, me, 'doneWishing')}
        >
          I'm done
        </button>
      </div>
    </div>
  )
}

function ParticipantPrioritisation({
  code,
  me,
  collectives,
  wishes,
  participants,
}: {
  code: string
  me: Participant
  collectives: CollectiveWish[]
  wishes: Wish[]
  participants: Participant[]
}) {
  const used = totalTokens(me.tokens)
  const doneCount = participants.filter((p) => p.doneAllocating).length

  if (me.doneAllocating) {
    return (
      <div className="screen center-screen">
        <h2 className="section-title">Your priorities are in.</h2>
        <p className="section-sub">You've helped decide what matters most.</p>
        <div className="ready-count">
          {doneCount} / {participants.length} participants complete
        </div>
      </div>
    )
  }

  async function change(tokens: Record<string, number>) {
    await setTokens(code, me, tokens)
  }

  return (
    <div className="screen">
      {!me.recapSeen && <RecapGate code={code} me={me} collectives={collectives} wishes={wishes} />}
      {me.recapSeen && (
        <>
          <h2 className="phase-title">Now, what matters most?</h2>
          <p className="phase-prompt">You can't choose everything.</p>
          <p className="phase-instruction">You have 3 priorities.</p>
          <div className="your-priorities">
            <span className="your-priorities-label">Your priorities</span>
            <TokenDots used={used} />
            <span className="your-priorities-remaining">
              {used < TOKENS_PER_PARTICIPANT
                ? `${TOKENS_PER_PARTICIPANT - used} left`
                : "You've used all 3 priorities"}
            </span>
          </div>
          <div className="collective-grid">
            {collectives.map((c) => (
              <CollectiveCard
                key={c.id}
                collective={c}
                wishes={wishes}
                myTokens={me.tokens[c.id] ?? 0}
                showTokens
                interactive={canAddToken(me.tokens)}
                onAddToken={(cid) => change({ ...me.tokens, [cid]: (me.tokens[cid] ?? 0) + 1 })}
                onRemoveToken={(cid) => change({ ...me.tokens, [cid]: Math.max(0, (me.tokens[cid] ?? 0) - 1) })}
              />
            ))}
          </div>
          <div className="wishing-footer">
            <button
              type="button"
              className="btn2 orange full"
              disabled={used === 0}
              onClick={() => markDone(code, me, 'doneAllocating')}
            >
              I'm done
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function RecapGate({
  code,
  me,
  collectives,
  wishes,
}: {
  code: string
  me: Participant
  collectives: CollectiveWish[]
  wishes: Wish[]
}) {
  return (
    <div>
      <h2 className="phase-title">Our wishlist</h2>
      <p className="phase-prompt">We found some common ground.</p>
      <div className="collective-grid">
        {collectives.map((c) => (
          <CollectiveCard key={c.id} collective={c} wishes={wishes} />
        ))}
      </div>
      <div className="wishing-footer">
        <button type="button" className="btn2 orange full" onClick={() => markDone(code, me, 'recapSeen')}>
          What matters most? →
        </button>
      </div>
    </div>
  )
}

function ParticipantResults({
  code,
  snapshot,
  me,
  collectives,
  participants,
}: {
  code: string
  snapshot: SessionSnapshot
  me: Participant
  collectives: CollectiveWish[]
  participants: Participant[]
}) {
  const ranking = useMemo(() => computeRanking(collectives, participants), [collectives, participants])
  const idx = snapshot.revealIndex
  const n = ranking.length
  const revealComplete = isRevealComplete(idx, n)

  // The finale is shown only after THIS participant acknowledges the full reveal
  // (ADR 0009): everyone watches #1 land, then continues on their own beat.
  if (me.doneResults) {
    return <ParticipantFinal collectives={collectives} participants={participants} />
  }

  const current = idx >= 0 ? ranking[n - 1 - idx] : null
  const shown = idx + 1

  return (
    <div className="screen">
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
          <div className="you-row">
            <div className="you-row-inner">
              <AvatarChip avatarId={me.avatarId} size="sm" />
              <div>
                <strong>You</strong>
                <span>3 priorities used</span>
              </div>
            </div>
          </div>
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
            <p className="reveal-empty">Waiting for the host to reveal the results…</p>
          )}
        </div>
      </div>
      <p className="results-caption">
        {shown} of {n} revealed
      </p>
      {revealComplete && (
        <div className="wishing-footer">
          <button type="button" className="btn2 orange full" onClick={() => markDone(code, me, 'doneResults')}>
            See our wishlist
          </button>
        </div>
      )}
    </div>
  )
}

function ParticipantFinal({
  collectives,
  participants,
}: {
  collectives: CollectiveWish[]
  participants: Participant[]
}) {
  const ranking = computeRanking(collectives, participants)
  const list = ranking.length > 0 ? ranking.map((r) => r.collective) : collectives
  return (
    <div className="screen center-screen">
      <div className="eyebrow">Session complete</div>
      <h2 className="final-headline">
        From our wishes
        <br />
        to our priorities.
      </h2>
      <p className="section-sub">
        You told us what you want.
        <br />
        You found what you have in common.
        <br />
        You decided what matters most.
      </p>
      <div className="collective-grid collective-grid-compact">
        {list.slice(0, 6).map((c) => (
          <div key={c.id} className="final-chip">
            {c.title}
          </div>
        ))}
      </div>
    </div>
  )
}
