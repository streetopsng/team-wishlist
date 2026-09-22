import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ParticipantRoom } from '@/pages/ParticipantRoom'
import { HostCreate } from '@/pages/HostCreate'
import { HostKeys } from '@/pages/HostKeys'
import { HostRoom } from '@/pages/HostRoom'
import { Join } from '@/pages/Join'
import { Landing } from '@/pages/Landing'
import { autoPromote } from '@/lib/domain'
import { clearIdentity, findMe, loadIdentity, saveIdentity } from '@/lib/identity'
import { applyAutoPromotion, registerPresence } from '@/lib/session'
import { useSession } from '@/hooks/useSession'

type Route =
  | { kind: 'landing' }
  | { kind: 'hostCreate' }
  | { kind: 'hostKeys'; code: string; hostKey: string }
  | { kind: 'host'; code: string; hostKey: string }
  | { kind: 'join'; code: string }
  | { kind: 'participant'; code: string }

function parseRoute(): Route {
  const path = window.location.pathname
  const params = new URLSearchParams(window.location.search)
  const hostMatch = path.match(/^\/host\/([A-Z2-9]+)/)
  if (hostMatch) {
    const key = params.get('key')
    return key
      ? { kind: 'host', code: hostMatch[1], hostKey: key }
      : { kind: 'hostCreate' }
  }
  const joinMatch = path.match(/^\/s\/([A-Z2-9]+)/)
  if (joinMatch) return { kind: 'join', code: joinMatch[1] }
  return { kind: 'landing' }
}

function navigate(to: string) {
  window.history.pushState(null, '', to)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export default function App() {
  const [route, setRoute] = useState<Route>(parseRoute)

  useEffect(() => {
    const onPop = () => setRoute(parseRoute())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Participant identity (ADR 0003): stored per session code.
  const identity =
    route.kind === 'join' || route.kind === 'participant' ? loadIdentity(route.code) : null
  const [freshJoin, setFreshJoin] = useState<{ code: string; pid: string; avatarId: string } | null>(
    null,
  )
  const pid =
    freshJoin && (route.kind === 'join' || route.kind === 'participant') && freshJoin.code === route.code
      ? freshJoin.pid
      : identity?.pid ?? null

  const code =
    route.kind === 'host' || route.kind === 'hostKeys'
      ? route.code
      : route.kind === 'join' || route.kind === 'participant'
        ? route.code
        : null

  const { snapshot, error, loading } = useSession(code)

  // Presence heartbeat for joined participants.
  const presencePid = route.kind === 'participant' && identity ? identity.pid : freshJoin?.pid
  const presenceCode = route.kind === 'participant' ? route.code : freshJoin?.code
  useEffect(() => {
    if (presenceCode && presencePid) return registerPresence(presenceCode, presencePid)
    return undefined
  }, [presenceCode, presencePid])

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
    navigate(`/s/${joinedCode}`)
  }, [])

  const me = useMemo(() => findMe(snapshot, pid), [snapshot, pid])

  if (import.meta.env.DEV) {
    // surface RTDB errors visibly during development
    if (error) console.error('[useSession]', error)
  }

  if (route.kind === 'landing') return <Landing onHost={() => { navigate('/host/create'); setRoute({ kind: 'hostCreate' }) }} />

  if (route.kind === 'hostCreate')
    return (
      <HostCreate
        onCreated={(createdCode, hostKey) => {
          navigate(`/host/${createdCode}?key=${hostKey}`)
          setRoute({ kind: 'hostKeys', code: createdCode, hostKey })
        }}
      />
    )

  if (route.kind === 'hostKeys')
    return (
      <HostKeys
        code={route.code}
        hostKey={route.hostKey}
        onContinue={() => setRoute({ kind: 'host', code: route.code, hostKey: route.hostKey })}
      />
    )

  if (route.kind === 'host') {
    if (loading) return <Splash text="Opening control room…" />
    if (!snapshot) return <Splash text={error ?? 'Session not found — check the link.'} />
    return <HostRoom code={route.code} hostKey={route.hostKey} snapshot={snapshot} />
  }

  // Participant routes: join first if no identity for this session yet.
  if (route.kind === 'join' || route.kind === 'participant') {
    if (loading) return <Splash text="Entering the room…" />
    if (!snapshot) return <Splash text={error ?? 'Session not found — check the link.'} />
    if (!me) {
      return (
        <Join
          code={route.code}
          claimedAvatarIds={snapshot.participants.map((p) => p.avatarId)}
          onJoined={(joinedPid, avatarId) => claimJoin(route.code, joinedPid, avatarId)}
        />
      )
    }
    return <ParticipantRoom code={route.code} snapshot={snapshot} me={me} />
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
