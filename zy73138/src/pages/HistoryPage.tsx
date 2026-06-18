import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { History, Map, ClipboardList, ChevronDown, ChevronUp } from 'lucide-react'
import { useWaterQualityStore } from '@/store'
import ChangeTimeline from '@/components/history/ChangeTimeline'
import VersionCompare from '@/components/history/VersionCompare'
import HistoryFilter from '@/components/history/HistoryFilter'

export default function HistoryPage() {
  const { changes, records } = useWaterQualityStore()

  const [filterRecordId, setFilterRecordId] = useState('')
  const [filterChangedBy, setFilterChangedBy] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const filteredChanges = useMemo(() => {
    let result = changes

    if (filterRecordId) {
      result = result.filter((c) =>
        c.recordId.toLowerCase().includes(filterRecordId.toLowerCase())
      )
    }

    if (filterChangedBy) {
      result = result.filter((c) =>
        c.changedBy.toLowerCase().includes(filterChangedBy.toLowerCase())
      )
    }

    if (filterDateFrom) {
      const from = new Date(filterDateFrom)
      result = result.filter((c) => new Date(c.changedAt) >= from)
    }

    if (filterDateTo) {
      const to = new Date(filterDateTo)
      to.setHours(23, 59, 59, 999)
      result = result.filter((c) => new Date(c.changedAt) <= to)
    }

    return result
  }, [changes, filterRecordId, filterChangedBy, filterDateFrom, filterDateTo])

  const groupedByRecord = useMemo(() => {
    const groups: Record<string, typeof filteredChanges> = {}
    for (const change of filteredChanges) {
      if (!groups[change.recordId]) {
        groups[change.recordId] = []
      }
      groups[change.recordId].push(change)
    }
    return groups
  }, [filteredChanges])

  const toggleGroup = (recordId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(recordId)) {
        next.delete(recordId)
      } else {
        next.add(recordId)
      }
      return next
    })
  }

  const getRecord = (recordId: string) =>
    records.find((r) => r.id === recordId)

  return (
    <div className="min-h-screen bg-ocean-900 text-foam font-sans">
      <nav className="border-b border-ocean-700 bg-ocean-900/95 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link
              to="/"
              className="flex items-center gap-2 text-foam/60 hover:text-tide transition-colors text-sm"
            >
              <Map className="w-4 h-4" />
              <span>地图</span>
            </Link>
            <Link
              to="/handover"
              className="flex items-center gap-2 text-foam/60 hover:text-tide transition-colors text-sm"
            >
              <ClipboardList className="w-4 h-4" />
              <span>交接</span>
            </Link>
            <div className="flex items-center gap-2 text-tide text-sm">
              <History className="w-4 h-4" />
              <span>变更历史</span>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <h1 className="font-serif text-2xl text-foam mb-8">变更历史</h1>

        <div className="mb-8">
          <HistoryFilter
            recordId={filterRecordId}
            changedBy={filterChangedBy}
            dateFrom={filterDateFrom}
            dateTo={filterDateTo}
            onRecordIdChange={setFilterRecordId}
            onChangedByChange={setFilterChangedBy}
            onDateFromChange={setFilterDateFrom}
            onDateToChange={setFilterDateTo}
          />
        </div>

        <div className="mb-10">
          <h2 className="text-sm text-foam/60 mb-4 tracking-wide">时间线总览</h2>
          <ChangeTimeline changes={filteredChanges} />
        </div>

        <div>
          <h2 className="text-sm text-foam/60 mb-4 tracking-wide">按记录分组</h2>
          <div className="space-y-3">
            {Object.entries(groupedByRecord).map(([recordId, recordChanges]) => {
              const record = getRecord(recordId)
              const isExpanded = expandedGroups.has(recordId)

              return (
                <div
                  key={recordId}
                  className="rounded-lg border border-ocean-700 overflow-hidden"
                >
                  <button
                    onClick={() => toggleGroup(recordId)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-ocean-800 hover:bg-ocean-800/80 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <Link
                        to={`/record/${recordId}`}
                        className="font-mono text-tide hover:text-tide-light text-sm transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {recordId}
                      </Link>
                      {record && (
                        <span className="text-foam/40 text-xs font-sans">
                          当前结论：
                          <span className="text-foam/70">{record.conclusion}</span>
                        </span>
                      )}
                      <span className="text-foam/30 text-xs font-sans">
                        {recordChanges.length} 次变更
                      </span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-foam/40" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-foam/40" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="p-4 bg-ocean-900 animate-fade-in">
                      <VersionCompare changes={recordChanges} />
                    </div>
                  )}
                </div>
              )
            })}

            {Object.keys(groupedByRecord).length === 0 && (
              <div className="text-center py-12 text-foam/30 font-sans text-sm">
                没有匹配的变更记录
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
