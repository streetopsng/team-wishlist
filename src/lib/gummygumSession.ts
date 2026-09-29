// Handles the handoff from the GummyGum hub: verifying a launch token on
// load and reporting this experience's outcome back to the hub when the
// launching player (the host) finishes their session.

const API_URL = import.meta.env.VITE_GUMMYGUM_API_URL || 'http://localhost:8000'
const STORAGE_KEY = 'gummygum_launch_session'

export interface GummyGumPlayer {
  id: string | null
  name: string
  email: string | null
}

export interface GummyGumLaunchSession {
  sessionId: string
  experienceId: string
  isGuest: boolean
  player: GummyGumPlayer | null
  reportToken: string
  roomCode: string | null
  isHost: boolean
  invitedCount?: number | null
  config: Record<string, unknown> | null
  hubUrl: string
  round: number
  reported: boolean
}

interface VerifyLaunchResponse {
  success: true
  data: {
    sessionId: string
    experienceId: string
    isGuest: boolean
    player: GummyGumPlayer | null
    reportToken: string
    roomCode?: string | null
    isHost?: boolean
    invitedCount?: number | null
    config?: Record<string, unknown> | null
    hubUrl?: string
  }
}

export function getGummyGumSession(): GummyGumLaunchSession | null {
  if (typeof window === 'undefined') return null
  const stored = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY)
  if (!stored) return null
  try {
    return JSON.parse(stored) as GummyGumLaunchSession
  } catch {
    return null
  }
}

async function verifyLaunchTokenOnce(ggt: string): Promise<VerifyLaunchResponse | null> {
  try {
    const res = await fetch(`${API_URL}/api/gummygum/launch/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: ggt }),
    })
    const body = (await res.json()) as VerifyLaunchResponse
    if (!res.ok || !body.success) return null
    return body
  } catch (err) {
    console.error('GummyGum launch verify failed', err)
    return null
  }
}

export async function resolveGummyGumLaunch(): Promise<GummyGumLaunchSession | null> {
  const params = new URLSearchParams(window.location.search)
  const ggt = params.get('ggt')

  if (!ggt) {
    return getGummyGumSession()
  }

  let body = await verifyLaunchTokenOnce(ggt)
  if (!body) {
    await new Promise((resolve) => setTimeout(resolve, 1500))
    body = await verifyLaunchTokenOnce(ggt)
  }

  if (!body) {
    // Single-use token already consumed and page refreshed: fall back to
    // whatever session is already stored rather than locking the user out.
    const existing = getGummyGumSession()
    if (existing) {
      params.delete('ggt')
      const query = params.toString()
      window.history.replaceState({}, '', window.location.pathname + (query ? `?${query}` : ''))
      return existing
    }
    return null
  }

  const hubUrl =
    body.data.hubUrl ||
    (typeof document !== 'undefined' && document.referrer ? new URL(document.referrer).origin : 'https://gummygum.app')

  const session: GummyGumLaunchSession = {
    sessionId: body.data.sessionId,
    experienceId: body.data.experienceId,
    isGuest: body.data.isGuest,
    player: body.data.player,
    reportToken: body.data.reportToken,
    roomCode: body.data.roomCode ?? null,
    isHost: Boolean(body.data.isHost),
    invitedCount: body.data.invitedCount ?? null,
    config: body.data.config ?? null,
    hubUrl,
    round: 1,
    reported: false,
  }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))

  params.delete('ggt')
  const query = params.toString()
  window.history.replaceState({}, '', window.location.pathname + (query ? `?${query}` : ''))

  return session
}

export async function reportGummyGumCancel(): Promise<void> {
  const session = getGummyGumSession()
  if (!session || !session.reportToken) return

  try {
    await fetch(`${API_URL}/api/gummygum/launch/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportToken: session.reportToken }),
    })
  } catch (err) {
    console.error('GummyGum cancel report failed', err)
  } finally {
    sessionStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(STORAGE_KEY)
  }
}

export async function reportGummyGumResult(report: Record<string, unknown>): Promise<void> {
  const session = getGummyGumSession()
  if (!session || !session.reportToken) return

  try {
    await fetch(`${API_URL}/api/gummygum/launch/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportToken: session.reportToken, report }),
    })
    session.reported = true
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch (err) {
    console.error('GummyGum result report failed', err)
  }
}

// Player / guest return: safe navigation back to GummyGum without closing the host's room
export function returnToGummyGum(): void {
  const session = getGummyGumSession()
  const hub = session?.hubUrl || 'https://gummygum.app'
  sessionStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(STORAGE_KEY)
  window.location.href = hub
}
