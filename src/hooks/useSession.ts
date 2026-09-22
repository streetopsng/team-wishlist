/** Live session subscription hook (ADR 0004). */
import { useEffect, useState } from 'react'
import type { SessionSnapshot } from '@/lib/session'
import { subscribeSession } from '@/lib/session'

export function useSession(code: string | null): {
  snapshot: SessionSnapshot | null
  error: string | null
  loading: boolean
} {
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!code) {
      setSnapshot(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const unsub = subscribeSession(
      code,
      (snap) => {
        setSnapshot(snap)
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      },
    )
    return unsub
  }, [code])

  return { snapshot, error, loading }
}
