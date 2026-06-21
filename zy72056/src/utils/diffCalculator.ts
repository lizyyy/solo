import type { StationPoint } from "@/data/types"

export interface DiffEntry {
  field: string
  oldValue: string
  newValue: string
  timestamp: string
  supplementId: string
}

export function computeDiffs(current: StationPoint, previous?: StationPoint): DiffEntry[] {
  if (!previous) {
    return current.supplements.map(s => ({
      field: s.field,
      oldValue: s.oldValue,
      newValue: s.newValue,
      timestamp: s.timestamp,
      supplementId: s.id,
    }))
  }

  const diffs: DiffEntry[] = []
  const trackedFields: (keyof StationPoint)[] = ["name", "floor", "type", "x", "y", "photo", "rawNote"]

  for (const field of trackedFields) {
    const oldVal = String(previous[field] ?? "")
    const newVal = String(current[field] ?? "")
    if (oldVal !== newVal) {
      const supplement = current.supplements.find(s => s.field === field)
      diffs.push({
        field,
        oldValue: oldVal,
        newValue: newVal,
        timestamp: supplement?.timestamp ?? current.lastModified,
        supplementId: supplement?.id ?? "",
      })
    }
  }

  return diffs
}

export function formatDiffEntry(diff: DiffEntry): string {
  return `${diff.field}: "${diff.oldValue}" → "${diff.newValue}" (${new Date(diff.timestamp).toLocaleString("zh-CN")})`
}
