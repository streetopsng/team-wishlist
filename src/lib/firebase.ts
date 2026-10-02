/**
 * Firebase bootstrap (ADR 0004).
 * Exports the Realtime Database handle used by all session operations, plus
 * DB helpers that wait for anonymous sign-in so the rules can require auth.
 */
import {
  getDatabase,
  get as rawGet,
  set as rawSet,
  update as rawUpdate,
  remove as rawRemove,
  runTransaction as rawRunTransaction,
  onValue as rawOnValue,
} from 'firebase/database'
import { getAuth, signInAnonymously } from 'firebase/auth'
import { app } from '../firebase.config'

export const db = getDatabase(app)
export const auth = getAuth(app)

// The anonymous uid only satisfies the rules (auth != null); it is not the participant identity.
// Never rejects, so the app keeps working under open rules if the Anonymous provider isn't enabled yet.
export const authReady: Promise<void> = auth
  .authStateReady()
  .then(() => (auth.currentUser ? undefined : signInAnonymously(auth).then(() => undefined)))
  .catch((err) => console.warn('Firebase anonymous sign-in failed, continuing without auth:', err))

export const get: typeof rawGet = (...args) => authReady.then(() => rawGet(...args))
export const set: typeof rawSet = (...args) => authReady.then(() => rawSet(...args))
export const update: typeof rawUpdate = (...args) => authReady.then(() => rawUpdate(...args))
export const remove: typeof rawRemove = (...args) => authReady.then(() => rawRemove(...args))
export const runTransaction: typeof rawRunTransaction = (...args) =>
  authReady.then(() => rawRunTransaction(...args))

export const onValue = ((...args: Parameters<typeof rawOnValue>) => {
  let unsubscribe: (() => void) | null = null
  let cancelled = false
  void authReady.then(() => {
    if (!cancelled) unsubscribe = (rawOnValue as (...a: unknown[]) => () => void)(...args)
  })
  return () => {
    cancelled = true
    unsubscribe?.()
  }
}) as typeof rawOnValue
