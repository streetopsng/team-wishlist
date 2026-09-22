import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

type RuleNode = Record<string, Record<string, string | undefined>>

const file = readFileSync(new URL('../../database.rules.json', import.meta.url), 'utf8')
const rules = (JSON.parse(file) as { rules: RuleNode }).rules

const session = rules.sessions.$code

describe('RTDB rules contract (ADR 0004/0010 security invariants)', () => {
  it('keeps the host key out of the readable session subtree', () => {
    // A child `.read: false` cannot revoke a cascading session-level read, so the
    // key must live at the top level, write-once and never readable.
    expect(rules.hostKeys).toBeDefined()
    expect(rules.hostKeys.$code).toBeDefined()
    expect(rules.hostKeys.$code['.write']).toBe('!data.exists()')
    expect(rules.hostKeys.$code['.read']).toBeUndefined()
    expect(session.meta.hostKey).toBeUndefined()
    expect(session.hostClaim).toBeUndefined()
  })

  it('keeps the write-only claim outside the readable session subtree too', () => {
    // The claim value equals the host key — readable, it would leak the key.
    expect(rules.claims).toBeDefined()
    expect(rules.claims.$code['.write']).toBe('true')
    expect(rules.claims.$code['.read']).toBeUndefined()
    expect(rules.claims.$code['.validate']).toContain('hostKeys')
  })

  it('allows session creation only — no cascading open write', () => {
    expect(session['.write']).toBe('!data.exists()')
  })

  it('gates meta, collectives, and reveal writes on a valid top-level claim', () => {
    const gated = [
      session.meta['.write'],
      session.collectives.$cid['.write'],
      session.reveal.index['.write'],
    ]
    for (const expr of gated) {
      expect(expr).toContain('claims/')
      expect(expr).toContain('hostKeys')
    }
  })

  it('allows wish creation and claim-gated collectiveId-only updates', () => {
    const wishWrite = session.wishes.$wid['.write'] ?? ''
    expect(wishWrite).toContain('!data.exists()')
    const updateBranch = wishWrite.split('|| ').slice(1).join('|| ')
    expect(updateBranch).toContain('claims/')
    // original wish fields must be immutable after creation — collectiveId is the
    // only mutable field, enforced by omission from the pin list
    for (const field of ['text', 'authorPid', 'avatarId', 'createdAt']) {
      expect(updateBranch).toContain(
        `newData.child('${field}').val() === data.child('${field}').val()`,
      )
    }
  })

  it('lets participants claim avatars and lets the app roll a claim back', () => {
    const expr = session.avatars.$avatarId['.write'] ?? ''
    expect(expr).toContain('!data.exists()')
    expect(expr).toContain('null')
  })

  it('validates every field the app writes into meta', () => {
    for (const field of ['name', 'phase', 'createdAt', 'cap', 'invitedCount', 'source']) {
      expect(session.meta[field]).toBeDefined()
    }
  })
})
