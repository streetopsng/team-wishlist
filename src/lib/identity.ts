/**
 * Identity persistence (ADR 0003): the claimed identity lives in localStorage
 * so a refresh transparently rejoins the same avatar on the same device.
 */
import type { Participant } from './domain'

const KEY_PREFIX = 'tw-identity:'

export interface StoredIdentity {
  code: string
  pid: string
  avatarId: string
}

export function saveIdentity(identity: StoredIdentity): void {
  localStorage.setItem(KEY_PREFIX + identity.code, JSON.stringify(identity))
}

export function loadIdentity(code: string): StoredIdentity | null {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + code)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredIdentity>
    if (
      typeof parsed.code === 'string' &&
      typeof parsed.pid === 'string' &&
      typeof parsed.avatarId === 'string'
    ) {
      return parsed as StoredIdentity
    }
    return null
  } catch {
    return null
  }
}

export function clearIdentity(code: string): void {
  localStorage.removeItem(KEY_PREFIX + code)
}

/** Look up a participant in a hydrated session snapshot by pid. */
export function findMe(
  snapshot: { participants: Participant[] } | null,
  pid: string | null,
): Participant | null {
  if (!snapshot || !pid) return null
  return snapshot.participants.find((p) => p.pid === pid) ?? null
}
