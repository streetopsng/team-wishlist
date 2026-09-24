/**
 * CSV export of session results (first v1.1 feature per ADR 0012 follow-up).
 *
 * Pure and Firebase-free so it can be unit tested (AGENT.MD rule 2).
 * RFC 4180 escaping; one row per rank entry, member wishes joined in a
 * single quoted field for spreadsheet-friendly capture.
 */
import type { RankEntry, Wish } from './domain'

const HEADER = 'rank,collective_wish,points,wish_count,member_wishes'

/** RFC 4180: quote if the field contains comma, quote, or newline; double quotes. */
export function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

/**
 * Build the results CSV. `member_wishes` lists every wish text that belongs
 * to the collective, joined with "; ", so one row is self-contained.
 */
export function resultsCsv(ranking: RankEntry[], wishes: Wish[]): string {
  if (ranking.length === 0) return HEADER
  const byCollective = new Map<string, string[]>()
  for (const w of wishes) {
    if (w.collectiveId === null) continue
    const list = byCollective.get(w.collectiveId) ?? []
    list.push(w.text)
    byCollective.set(w.collectiveId, list)
  }
  const rows = ranking.map((r: RankEntry) => {
    const members = byCollective.get(r.collective.id) ?? []
    return [
      String(r.rank),
      csvEscape(r.collective.title),
      String(r.points),
      String(members.length),
      csvEscape(members.join('; ')),
    ].join(',')
  })
  return [HEADER, ...rows].join('\n')
}

/** Safe download filename: `team-wishlist-{code}-{slug}.csv`. */
export function resultsFilename(code: string, sessionName: string): string {
  const slug = sessionName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'session'
  return `team-wishlist-${code}-${slug}.csv`
}

/** Trigger a browser download of `csv` as `filename` (no-op-safe outside browser). */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Convenience: export a ranking straight to a downloaded file. */
export function exportResults(
  code: string,
  sessionName: string,
  ranking: RankEntry[],
  wishes: Wish[],
): void {
  downloadCsv(resultsFilename(code, sessionName), resultsCsv(ranking, wishes))
}
