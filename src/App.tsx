import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ParticipantRoom } from '@/pages/ParticipantRoom'
import { HostRoom } from '@/pages/HostRoom'
import { Join } from '@/pages/Join'
import { SessionExpiredModal } from '@/components/SessionExpiredModal'
import { SessionEndedScreen } from '@/components/SessionEndedScreen'
import { LoadingScreen } from '@/components/LoadingScreen'
import { autoPromote, isLobbyIdleExpired, isSessionAbandoned } from '@/lib/domain'
import { clearGummyGumHostKey, clearIdentity, findMe, loadGummyGumHostKey, loadIdentity, saveGummyGumHostKey, saveIdentity } from '@/lib/identity'
import { applyAutoPromotion, createSession, generateHostKey, invitePid, markSessionAbandoned, markSessionEnded, registerPresence } from '@/lib/session'
import { useSession } from '@/hooks/useSession'
import { gummyGumRoomCode, reportGummyGumCancel, resolveGummyGumLaunch, returnToGummyGum, watchHubSessionStatus, type GummyGumLaunchSession } from '@/lib/gummygumSession'

// Team Wishlist only runs from a GummyGum launch, so there is no landing or create route:
// anything unrouted waits on the loading screen until the launch routes it.
type Route =
  | { kind: 'launching' }
  | { kind: 'host'; code: string; hostKey: string }
  | { kind: 'join'; code: string }
  | { kind: 'participant'; code: string }

function parseRoute(): Route {
  const path = window.location.pathname
  const params = new URLSearchParams(window.location.search)
  const hostMatch = path.match(/^\/host\/([A-Z2-9]+)/)
  if (hostMatch) {
    const key = params.get('key')
    return key ? { kind: 'host', code: hostMatch[1], hostKey: key } : { kind: 'launching' }
  }
  const joinMatch = path.match(/^\/s\/([A-Z2-9]+)/)
  if (joinMatch) return { kind: 'join', code: joinMatch[1] }
  return { kind: 'launching' }
}

function GummyGumLockedScreen() {
  return (
    <div className="screen center-screen">
      <h2 className="section-title">This experience is only available through GummyGum</h2>
      <p className="section-sub">Open it from the GummyGum hub to run a session.</p>
      <a href="https://gummygum.app" className="btn2 orange" style={{ marginTop: 18, textDecoration: 'none', display: 'inline-block' }}>
        Go to GummyGum
      </a>
    </div>
  )
}

export default function App() {
  const [route, setRoute] = useState<Route>(parseRoute)

  useEffect(() => {
    const onPop = () => setRoute(parseRoute())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const [ggSession, setGgSession] = useState<GummyGumLaunchSession | null>(null)
  const [ggAccessState, setGgAccessState] = useState<'checking' | 'granted' | 'denied'>('checking')
  const [ggResolvingHost, setGgResolvingHost] = useState(false)
  const [ggHostRecoveryFailed, setGgHostRecoveryFailed] = useState(false)
  const ggRoutedRef = useRef(false)
  const ggRoomCode = gummyGumRoomCode(ggSession)

  useEffect(() => {
    resolveGummyGumLaunch().then((gg) => {
      setGgSession(gg)
      setGgAccessState(gg ? 'granted' : 'denied')
    })
  }, [])

  // Participant identity (ADR 0003): stored per session code.
  const identity =
    route.kind === 'join' || route.kind === 'participant' ? loadIdentity(route.code) : null
  const [freshJoin, setFreshJoin] = useState<{ code: string; pid: string; avatarId: string } | null>(
    null,
  )
  const participantCode = route.kind === 'join' || route.kind === 'participant' ? route.code : null
  const ggEmail = ggSession && !ggSession.isHost ? ggSession.player?.email ?? null : null
  const [ggPid, setGgPid] = useState<{ code: string; pid: string | null } | null>(null)
  useEffect(() => {
    if (!participantCode || !ggEmail) return
    let cancelled = false
    invitePid(participantCode, ggEmail)
      .then((derived) => { if (!cancelled) setGgPid({ code: participantCode, pid: derived }) })
      .catch(() => { if (!cancelled) setGgPid({ code: participantCode, pid: null }) })
    return () => { cancelled = true }
  }, [participantCode, ggEmail])
  const ggPidPending = Boolean(participantCode && ggEmail) && ggPid?.code !== participantCode
  const invitedPid = ggPid && ggPid.code === participantCode ? ggPid.pid : null

  // Subscribe to the hub's code before routing so we know whether to resume or create.
  const code =
    ggResolvingHost && ggRoomCode
      ? ggRoomCode
      : route.kind === 'host'
        ? route.code
        : route.kind === 'join' || route.kind === 'participant'
          ? route.code
          : null

  const { snapshot, error, loading } = useSession(code)

  // The invite email is the identity: its derived pid wins so the same invitee never gets a second participant.
  const invitedPidJoined = Boolean(invitedPid && snapshot?.participants.some((p) => p.pid === invitedPid))
  const pid =
    freshJoin && participantCode && freshJoin.code === participantCode
      ? freshJoin.pid
      : invitedPidJoined
        ? invitedPid
        : identity?.pid ?? null

  useEffect(() => {
    if (ggRoutedRef.current) return
    if (ggAccessState !== 'granted' || !ggSession) return
    ggRoutedRef.current = true
    if (ggSession.isHost && ggRoomCode) {
      const cachedKey = loadGummyGumHostKey(ggRoomCode)
      if (cachedKey) {
        setRoute({ kind: 'host', code: ggRoomCode, hostKey: cachedKey })
      } else {
        setGgResolvingHost(true)
      }
    } else if (ggRoomCode) {
      setRoute({ kind: 'join', code: ggRoomCode })
    }
  }, [ggAccessState, ggSession, ggRoomCode])

  // Our own createSession fires the listener before it resolves; without this guard that
  // snapshot read as "someone else's room" and failed the first launch.
  const ggCreateStartedRef = useRef(false)
  useEffect(() => {
    if (!ggResolvingHost || !ggSession || !ggRoomCode || loading || ggCreateStartedRef.current) return
    const rc = ggRoomCode
    if (snapshot) {
      // Host key is write-once and never server-readable (ADR 0010), so it can't be recovered here.
      setGgResolvingHost(false)
      setGgHostRecoveryFailed(true)
      return
    }
    ggCreateStartedRef.current = true
    const cfg = (ggSession.config as { name?: string; invitedCount?: number } | null) ?? null
    // Cached before any write so a tab closed mid-create can still resume the room.
    const presetKey = generateHostKey()
    saveGummyGumHostKey(rc, presetKey)
    createSession(cfg?.name || 'Team Wishlist Session', cfg?.invitedCount || ggSession.invitedCount || 10, rc, presetKey)
      .then(({ code: createdCode, hostKey }) => {
        setGgResolvingHost(false)
        setRoute({ kind: 'host', code: createdCode, hostKey })
      })
      .catch(() => {
        clearGummyGumHostKey(rc)
        setGgResolvingHost(false)
        setGgHostRecoveryFailed(true)
      })
  }, [ggResolvingHost, ggSession, ggRoomCode, loading, snapshot])

  const [abandonedOnLoad, setAbandonedOnLoad] = useState(false)
  const abandonCheckedRef = useRef<string | null>(null)
  // Evaluated once per room on first load, so live presence from this client can't mask abandonment.
  useEffect(() => {
    if (!snapshot || !code || abandonCheckedRef.current === code) return
    abandonCheckedRef.current = code
    const activity = {
      phase: snapshot.meta.phase,
      createdAt: snapshot.meta.createdAt,
      phaseChangedAt: snapshot.meta.phaseChangedAt,
      participants: snapshot.participants,
      wishes: snapshot.wishes,
      collectives: snapshot.collectives,
    }
    if (isSessionAbandoned(activity, pid, Date.now())) setAbandonedOnLoad(true)
  }, [snapshot, code, pid])

  const [lobbyExpired, setLobbyExpired] = useState(false)
  const livePhase = snapshot?.meta.phase
  const createdAt = snapshot?.meta.createdAt ?? 0
  useEffect(() => {
    if (livePhase !== 'SETUP') return undefined
    const check = () => {
      if (isLobbyIdleExpired(livePhase, createdAt, Date.now())) setLobbyExpired(true)
    }
    check()
    const timer = setInterval(check, 10_000)
    return () => clearInterval(timer)
  }, [livePhase, createdAt])

  const isAbandoned = abandonedOnLoad || Boolean(snapshot?.meta.abandoned)
  const expiredContext: 'lobby' | 'game' | null = isAbandoned ? 'game' : lobbyExpired ? 'lobby' : null

  // Host persists the abandoned flag for everyone and reports it to GummyGum as cancelled, once.
  const abandonHandledRef = useRef(false)
  useEffect(() => {
    if (!isAbandoned || route.kind !== 'host' || abandonHandledRef.current) return
    abandonHandledRef.current = true
    if (!snapshot?.meta.abandoned) void markSessionAbandoned(route.code, route.hostKey).catch(() => undefined)
    if (ggSession?.isHost) void reportGummyGumCancel()
  }, [isAbandoned, route, snapshot, ggSession])

  const [hubEnded, setHubEnded] = useState(false)
  const hubPin = ggSession?.roomCode ?? null
  const hubHostedSessionId = ggSession?.hostedSessionId ?? null
  // A COMPLETE room reports its own result, which also ends the hub session; keep the final screen.
  const watchHub = Boolean(hubPin && hubHostedSessionId) && !hubEnded && !expiredContext && livePhase !== 'COMPLETE'
  useEffect(() => {
    if (!watchHub || !hubPin || !hubHostedSessionId) return undefined
    return watchHubSessionStatus({ pin: hubPin, hostedSessionId: hubHostedSessionId, onEnded: () => setHubEnded(true) })
  }, [watchHub, hubPin, hubHostedSessionId])

  const isEnded = (hubEnded || Boolean(snapshot?.meta.ended)) && livePhase !== 'COMPLETE'

  // The session is already closed on the hub, so the host leaves without reporting cancel again.
  const endHandledRef = useRef(false)
  const hubUrl = ggSession?.hubUrl
  useEffect(() => {
    if (!isEnded || route.kind !== 'host' || endHandledRef.current) return
    endHandledRef.current = true
    const persist = snapshot?.meta.ended ? Promise.resolve() : markSessionEnded(route.code, route.hostKey)
    void persist.catch(() => undefined).finally(() => returnToGummyGum(hubUrl))
  }, [isEnded, route, snapshot, hubUrl])

  // Presence heartbeat for joined participants.
  const presencePid = route.kind === 'participant' && identity ? identity.pid : freshJoin?.pid
  const presenceCode = route.kind === 'participant' ? route.code : freshJoin?.code
  useEffect(() => {
    if (presenceCode && presencePid && !expiredContext && !isEnded) return registerPresence(presenceCode, presencePid)
    return undefined
  }, [presenceCode, presencePid, expiredContext, isEnded])

  // MATCHING -> PRIORITISATION auto-promotion (ADR 0007): the host client performs it.
  const promoteKeyRef = useRef<string | null>(null)
  useEffect(() => {
    if (route.kind !== 'host' || !snapshot) return
    if (snapshot.meta.phase !== 'PRIORITISATION') {
      promoteKeyRef.current = null
      return
    }
    const key = `${route.code}`
    if (promoteKeyRef.current === key) return
    const ungrouped = snapshot.wishes.filter((w) => w.collectiveId === null)
    const orphanCollectives = snapshot.collectives.filter(
      (c) => !snapshot.wishes.some((w) => w.collectiveId === c.id),
    )
    if (ungrouped.length === 0 && orphanCollectives.length === 0) {
      promoteKeyRef.current = key
      return
    }
    const result = autoPromote(snapshot.wishes, snapshot.collectives)
    promoteKeyRef.current = key
    applyAutoPromotion(route.code, route.hostKey, result.collectives, result.assignments).catch(
      () => (promoteKeyRef.current = null),
    )
  }, [route, snapshot])

  const claimJoin = useCallback((joinedCode: string, joinedPid: string, avatarId: string) => {
    saveIdentity({ code: joinedCode, pid: joinedPid, avatarId })
    setFreshJoin({ code: joinedCode, pid: joinedPid, avatarId })
    // Hub codes may not match the /s/[A-Z2-9]+ route pattern, so the URL is left as launched.
    setRoute({ kind: 'participant', code: joinedCode })
  }, [])

  const me = useMemo(() => findMe(snapshot, pid), [snapshot, pid])

  // Adopt a reclaimed invite slot locally so presence and later refreshes use it.
  useEffect(() => {
    if (!participantCode || !invitedPidJoined || !me || me.pid !== invitedPid) return
    if (identity?.pid === invitedPid && freshJoin?.pid === invitedPid) return
    claimJoin(participantCode, me.pid, me.avatarId)
  }, [participantCode, invitedPidJoined, invitedPid, me, identity?.pid, freshJoin?.pid, claimJoin])

  const expiredModal = expiredContext ? (
    <SessionExpiredModal isHost={route.kind === 'host'} context={expiredContext} hubUrl={ggSession?.hubUrl ?? null} />
  ) : null

  if (import.meta.env.DEV) {
    // surface RTDB errors visibly during development
    if (error) console.error('[useSession]', error)
  }

  if (ggAccessState === 'checking') return <LoadingScreen />
  if (ggAccessState === 'denied') return <GummyGumLockedScreen />

  if (ggHostRecoveryFailed) {
    return (
      <div className="screen center-screen">
        <h2 className="section-title">Host access couldn&apos;t be restored</h2>
        <p className="section-sub">Return to GummyGum and relaunch this session as the host.</p>
        <button type="button" className="btn2 orange" style={{ marginTop: 18 }} onClick={() => returnToGummyGum()}>
          Back to GummyGum
        </button>
      </div>
    )
  }

  if (ggResolvingHost) return <LoadingScreen />

  if (ggSession && isEnded && (route.kind === 'host' || route.kind === 'join' || route.kind === 'participant')) {
    return <SessionEndedScreen isHost={route.kind === 'host'} hubUrl={ggSession.hubUrl} />
  }

  if (route.kind === 'launching') return ggRoomCode ? <LoadingScreen /> : <GummyGumLockedScreen />

  if (route.kind === 'host') {
    if (loading) return <LoadingScreen />
    if (!snapshot) return <Splash text={error ?? 'Session not found — check the link.'} />
    return (
      <>
        <HostRoom code={route.code} hostKey={route.hostKey} snapshot={snapshot} ggSession={ggSession} />
        {expiredModal}
      </>
    )
  }

  // Participant routes: join first if no identity for this session yet.
  if (route.kind === 'join' || route.kind === 'participant') {
    if (loading) return <LoadingScreen />
    if (!snapshot) {
      if (ggSession && !error) return <Splash text="Waiting for the host to open the room..." />
      return <Splash text={error ?? 'Session not found — check the link.'} />
    }
    if (!me) {
      if (ggPidPending) return <LoadingScreen />
      return (
        <>
          <Join
            code={route.code}
            claimedAvatarIds={snapshot.participants.map((p) => p.avatarId)}
            playerName={ggSession?.player?.name?.trim() || null}
            presetPid={invitedPid}
            onJoined={(joinedPid, avatarId) => claimJoin(route.code, joinedPid, avatarId)}
          />
          {expiredModal}
        </>
      )
    }
    return (
      <>
        <ParticipantRoom code={route.code} snapshot={snapshot} me={me} ggSession={ggSession} />
        {expiredModal}
      </>
    )
  }

  void clearIdentity // re-exported for future "leave room" affordance
  return null
}

function Splash({ text }: { text: string }) {
  return (
    <div className="screen center-screen">
      <div className="loader-text">{text}</div>
    </div>
  )
}
