/** Live session subscription hook (ADR 0004). */
import { useEffect, useState } from 'react'
import type { SessionSnapshot } from '@/lib/session'
import { subscribeSession } from '@/lib/session'

interface SessionState {
  code: string | null
  snapshot: SessionSnapshot | null
  error: string | null
}

export function useSession(code: string | null): {
  snapshot: SessionSnapshot | null
  error: string | null
  loading: boolean
} {
  const [state, setState] = useState<SessionState>({ code: null, snapshot: null, error: null })

  useEffect(() => {
    if (!code) return undefined
    return subscribeSession(
      code,
      (snap) => setState({ code, snapshot: snap, error: null }),
      (err) =>
        setState((prev) => ({ code, snapshot: prev.code === code ? prev.snapshot : null, error: err.message })),
    )
  }, [code])

  if (!code) return { snapshot: null, error: null, loading: false }
  // State from a previous code must read as loading, or callers act on a stale "no room yet".
  const current = state.code === code
  return {
    snapshot: current ? state.snapshot : null,
    error: current ? state.error : null,
    loading: !current,
  }
}
