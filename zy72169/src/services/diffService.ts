import type { Location, DiffEntry } from '@/types'

export function computeDiff(before: Location[], after: Location[]): DiffEntry[] {
  const entries: DiffEntry[] = []
  const timestamp = new Date().toISOString()

  const beforeMap = new Map(before.map((loc) => [loc.id, loc]))
  const afterMap = new Map(after.map((loc) => [loc.id, loc]))

  for (const [id, afterLoc] of afterMap) {
    const beforeLoc = beforeMap.get(id)
    if (!beforeLoc) {
      entries.push({
        type: 'added',
        entity: 'Location',
        id,
        timestamp,
      })
      continue
    }

    const fields: (keyof Location)[] = [
      'originalName', 'canonicalName', 'address', 'chargerCount',
      'status', 'source', 'sourceDetail', 'mergeStatus',
      'isException', 'exceptionNote', 'rawNote',
    ]

    for (const field of fields) {
      if (beforeLoc[field] !== afterLoc[field]) {
        entries.push({
          type: 'modified',
          entity: 'Location',
          id,
          field,
          before: String(beforeLoc[field]),
          after: String(afterLoc[field]),
          timestamp,
        })
      }
    }
  }

  for (const [id] of beforeMap) {
    if (!afterMap.has(id)) {
      entries.push({
        type: 'removed',
        entity: 'Location',
        id,
        timestamp,
      })
    }
  }

  return entries
}

export function formatDiffSummary(entries: DiffEntry[]): string {
  let added = 0
  let modified = 0
  let removed = 0

  for (const entry of entries) {
    if (entry.type === 'added') added++
    else if (entry.type === 'modified') modified++
    else if (entry.type === 'removed') removed++
  }

  const parts: string[] = []
  if (added > 0) parts.push(`新增${added}条点位`)
  if (modified > 0) parts.push(`修改${modified}条点位`)
  if (removed > 0) parts.push(`移除${removed}条点位`)

  return parts.join('，')
}
