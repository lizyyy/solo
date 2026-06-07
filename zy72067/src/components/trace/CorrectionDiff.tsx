import { useState, useMemo } from 'react'
import { ChevronDown, ChevronRight, GitCompare, User, Clock, FileJson, Filter } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStore } from '@/store/useStore'
import type { CorrectionSnapshot, HotSpotRecord } from '@/types'

const FIELD_LABELS: Record<string, string> = {
  temperature: '温度',
  name: '名称',
  coordinateX: 'X坐标',
  coordinateY: 'Y坐标',
}

interface SnapshotWithRecord extends CorrectionSnapshot {
  record?: HotSpotRecord
}

function DiffCard({ snapshot }: { snapshot: SnapshotWithRecord }) {
  const [expanded, setExpanded] = useState(false)

  const formatValue = (value: string, fieldName: string) => {
    if (fieldName === 'temperature') {
      return `${value}°C`
    }
    if (fieldName === 'coordinateX' || fieldName === 'coordinateY') {
      return Number(value).toFixed(2)
    }
    return value
  }

  return (
    <div className="border border-gray-700/50 rounded-lg overflow-hidden bg-[#1a1a2e]/60">
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Clock className="w-4 h-4 text-gray-500" />
          <span className="text-xs text-gray-400">{snapshot.correctedAt}</span>
          <span className="text-gray-600">•</span>
          <User className="w-4 h-4 text-gray-500" />
          <span className="text-xs text-gray-400">{snapshot.correctedBy}</span>
          <span className="text-gray-600">•</span>
          <span className="text-xs text-amber-400 font-medium">
            {FIELD_LABELS[snapshot.fieldName] || snapshot.fieldName}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-300">关联记录：</span>
          <button className="text-sm text-amber-400 hover:text-amber-300 transition-colors underline underline-offset-2">
            {snapshot.record?.name || snapshot.recordId}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700/30">
            <div className="text-xs text-gray-500 mb-2 font-medium">补录前</div>
            <div className="text-sm text-gray-500 line-through">
              {formatValue(snapshot.oldValue, snapshot.fieldName)}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <div className="text-xs text-amber-400 mb-2 font-medium">补录后</div>
            <div className="text-sm text-amber-300 font-medium">
              {formatValue(snapshot.newValue, snapshot.fieldName)}
            </div>
          </div>
        </div>

        {snapshot.reason && (
          <div className="pt-2 border-t border-gray-700/30">
            <p className="text-xs text-gray-500 italic">
              原因：{snapshot.reason}
            </p>
          </div>
        )}

        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-2 py-2 text-xs text-gray-400 hover:text-gray-300 transition-colors border-t border-gray-700/30"
        >
          {expanded ? (
            <>
              <ChevronDown className="w-4 h-4" />
              收起快照数据
            </>
          ) : (
            <>
              <ChevronRight className="w-4 h-4" />
              <FileJson className="w-4 h-4" />
              查看快照数据
            </>
          )}
        </button>

        {expanded && (
          <div className="p-3 rounded-lg bg-gray-900/80 border border-gray-700/50">
            <pre className="text-xs text-gray-400 overflow-x-auto whitespace-pre-wrap">
              {snapshot.snapshotData}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

export default function CorrectionDiff() {
  const [recordFilter, setRecordFilter] = useState<string>('all')
  const [fieldFilter, setFieldFilter] = useState<string>('all')
  const [operatorFilter, setOperatorFilter] = useState<string>('all')

  const records = useStore(s => s.records)
  const snapshotsByRecord = useStore(s => s.snapshotsByRecord)

  const allSnapshots = useMemo(() => {
    const snapshots: SnapshotWithRecord[] = []
    for (const recordId of Object.keys(snapshotsByRecord)) {
      const record = records.find(r => r.id === recordId)
      for (const snapshot of snapshotsByRecord[recordId]) {
        snapshots.push({ ...snapshot, record })
      }
    }
    return snapshots.sort((a, b) => new Date(b.correctedAt).getTime() - new Date(a.correctedAt).getTime())
  }, [snapshotsByRecord, records])

  const operators = useMemo(() => {
    const set = new Set(allSnapshots.map(s => s.correctedBy))
    return Array.from(set)
  }, [allSnapshots])

  const filteredSnapshots = useMemo(() => {
    return allSnapshots.filter(s => {
      if (recordFilter !== 'all' && s.recordId !== recordFilter) return false
      if (fieldFilter !== 'all' && s.fieldName !== fieldFilter) return false
      if (operatorFilter !== 'all' && s.correctedBy !== operatorFilter) return false
      return true
    })
  }, [allSnapshots, recordFilter, fieldFilter, operatorFilter])

  const stats = useMemo(() => {
    const totalCount = allSnapshots.length
    const recordSet = new Set(allSnapshots.map(s => s.recordId))
    const fieldCounts: Record<string, number> = {}
    for (const s of allSnapshots) {
      fieldCounts[s.fieldName] = (fieldCounts[s.fieldName] || 0) + 1
    }
    return {
      totalCount,
      recordCount: recordSet.size,
      fieldCounts,
    }
  }, [allSnapshots])

  if (allSnapshots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500 space-y-3">
        <GitCompare className="w-12 h-12 text-gray-600" />
        <p>暂无补录差异记录</p>
      </div>
    )
  }

  return (
    <div className="p-4 overflow-y-auto max-h-[calc(100vh-180px)] space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="p-4 rounded-lg bg-gray-800/50 border border-gray-700/30">
          <div className="text-xs text-gray-400 mb-1">补录总次数</div>
          <div className="text-2xl font-bold text-amber-400">{stats.totalCount}</div>
        </div>
        <div className="p-4 rounded-lg bg-gray-800/50 border border-gray-700/30">
          <div className="text-xs text-gray-400 mb-1">涉及记录数</div>
          <div className="text-2xl font-bold text-blue-400">{stats.recordCount}</div>
        </div>
        <div className="p-4 rounded-lg bg-gray-800/50 border border-gray-700/30">
          <div className="text-xs text-gray-400 mb-1">各字段补录次数</div>
          <div className="flex flex-wrap gap-2 mt-1">
            {Object.entries(stats.fieldCounts).map(([field, count]) => (
              <span key={field} className="text-xs px-2 py-0.5 rounded bg-gray-700/50 text-gray-300">
                {FIELD_LABELS[field] || field}: {count}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap p-3 rounded-lg bg-gray-800/30 border border-gray-700/30">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-xs text-gray-400">筛选：</span>
        </div>
        <select
          value={recordFilter}
          onChange={e => setRecordFilter(e.target.value)}
          className="bg-[#1a1a2e] border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-amber-500"
        >
          <option value="all">全部记录</option>
          {records.map(r => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        <select
          value={fieldFilter}
          onChange={e => setFieldFilter(e.target.value)}
          className="bg-[#1a1a2e] border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-amber-500"
        >
          <option value="all">全部字段</option>
          <option value="temperature">温度</option>
          <option value="name">名称</option>
          <option value="coordinateX">X坐标</option>
          <option value="coordinateY">Y坐标</option>
        </select>
        <select
          value={operatorFilter}
          onChange={e => setOperatorFilter(e.target.value)}
          className="bg-[#1a1a2e] border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-amber-500"
        >
          <option value="all">全部操作人</option>
          {operators.map(op => (
            <option key={op} value={op}>{op}</option>
          ))}
        </select>
      </div>

      {filteredSnapshots.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-gray-500">
          没有符合筛选条件的记录
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSnapshots.map(s => (
            <DiffCard key={s.id} snapshot={s} />
          ))}
        </div>
      )}
    </div>
  )
}
