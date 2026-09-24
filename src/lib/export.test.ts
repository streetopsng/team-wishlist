import { describe, expect, it } from 'vitest'
import { csvEscape, resultsCsv, resultsFilename } from './export'
import { computeRanking, type CollectiveWish, type Participant, type Wish } from './domain'

const collective = (id: string, title: string, createdAt: number): CollectiveWish => ({
  id,
  title,
  createdAt,
  autoPromoted: false,
})

const participant = (tokens: Record<string, number>): Participant => ({
  pid: 'p',
  avatarId: 'a0',
  joinedAt: 0,
  online: true,
  doneWishing: true,
  recapSeen: true,
  doneAllocating: true,
  doneResults: true,
  tokens,
})

const wish = (id: string, text: string, collectiveId: string): Wish => ({
  id,
  text,
  authorPid: 'p1',
  avatarId: 'a0',
  createdAt: 1,
  collectiveId,
})

describe('csvEscape (RFC 4180)', () => {
  it('leaves plain fields untouched', () => {
    expect(csvEscape('More learning days')).toBe('More learning days')
  })

  it('quotes fields containing commas, quotes, or newlines', () => {
    expect(csvEscape('a, b')).toBe('"a, b"')
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""')
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"')
  })
})

describe('resultsCsv', () => {
  it('exports header and one row per rank entry, in rank order', () => {
    const cs = [collective('cw1', 'Quiet room', 1), collective('cw2', 'Better tools', 2)]
    const ps = [participant({ cw1: 3, cw2: 1 })]
    const csv = resultsCsv(computeRanking(cs, ps), [])
    const lines = csv.split('\n')
    expect(lines[0]).toBe('rank,collective_wish,points,wish_count,member_wishes')
    expect(lines[1]).toBe('1,Quiet room,3,0,')
    expect(lines[2]).toBe('2,Better tools,1,0,')
  })

  it('joins member wish texts with "; " in one field', () => {
    const cs = [collective('cw1', 'Quiet room', 1)]
    const ws = [wish('w1', 'No meetings Friday', 'cw1'), wish('w2', 'Focus time', 'cw1')]
    const csv = resultsCsv(computeRanking(cs, [participant({ cw1: 2 })]), ws)
    const row = csv.split('\n')[1]
    expect(row).toBe('1,Quiet room,2,2,No meetings Friday; Focus time')
  })

  it('escapes hostile wish text without breaking the row structure', () => {
    const cs = [collective('cw1', 'Title, with comma', 1)]
    const ws = [wish('w1', 'He said "enough", then left\nall day', 'cw1')]
    const csv = resultsCsv(computeRanking(cs, [participant({ cw1: 1 })]), ws)
    expect(csv).toBe(
      'rank,collective_wish,points,wish_count,member_wishes\n' +
        '1,"Title, with comma",1,1,"He said ""enough"", then left\nall day"',
    )
  })

  it('returns header only when there are no results', () => {
    expect(resultsCsv([], [])).toBe('rank,collective_wish,points,wish_count,member_wishes')
  })

  it('ignores wishes that belong to no exported collective', () => {
    const cs = [collective('cw1', 'Solo', 1)]
    const ws = [wish('w1', 'belongs', 'cw1'), wish('w2', 'orphan', 'cw-gone')]
    const csv = resultsCsv(computeRanking(cs, [participant({ cw1: 1 })]), ws)
    expect(csv.split('\n')[1]).toBe('1,Solo,1,1,belongs')
  })
})

describe('resultsFilename', () => {
  it('builds a safe download name from code and session name', () => {
    expect(resultsFilename('AB12CD', 'Sprint retro')).toBe('team-wishlist-AB12CD-sprint-retro.csv')
  })

  it('strips characters unsafe for filenames', () => {
    expect(resultsFilename('X1', 'Q3 / planning: "final"')).toBe('team-wishlist-X1-q3-planning-final.csv')
  })
})
