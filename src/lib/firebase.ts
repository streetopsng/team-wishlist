/**
 * Firebase bootstrap (ADR 0004).
 * Exports the Realtime Database handle used by all session operations.
 */
import { getDatabase } from 'firebase/database'
import { app } from '../firebase.config'

export const db = getDatabase(app)
