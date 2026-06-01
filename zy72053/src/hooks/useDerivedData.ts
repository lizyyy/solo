import { useMemo } from 'react'
import { useStore } from '@/store/useStore'

export function useFilteredPoints() {
  const points = useStore((s) => s.points)
  const filters = useStore((s) => s.filters)

  return useMemo(() => {
    return points.filter((p) => {
      if (filters.severity.length > 0 && !filters.severity.includes(p.severity)) return false
      if (filters.sources.length > 0 && !filters.sources.includes(p.source)) return false
      if (filters.pipeIds.length > 0 && !filters.pipeIds.includes(p.pipeId)) return false
      if (filters.status.length > 0 && !filters.status.includes(p.status)) return false
      const d = p.inspectedAt.slice(0, 10)
      if (d < filters.dateRange[0] || d > filters.dateRange[1]) return false
      return true
    })
  }, [points, filters])
}

export function useStats() {
  const filtered = useFilteredPoints()
  const qcRecords = useStore((s) => s.qcRecords)

  return useMemo(() => {
    const conflictPointIds = new Set(
      qcRecords
        .filter((q) => q.issueType === 'conflict' && q.status === 'open')
        .map((q) => q.pointId)
    )
    return {
      total: filtered.length,
      anomaly: filtered.filter((p) => p.status === 'anomaly').length,
      exception: filtered.filter((p) => p.status === 'exception').length,
      conflict: filtered.filter((p) => conflictPointIds.has(p.id)).length,
    }
  }, [filtered, qcRecords])
}
