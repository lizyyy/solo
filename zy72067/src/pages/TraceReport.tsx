import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { useStore } from '@/store/useStore'
import Timeline from '@/components/trace/Timeline'
import ConflictCompare from '@/components/trace/ConflictCompare'
import ExportPanel from '@/components/trace/ExportPanel'

const SCHEME_ID = 'demo-001'

const TABS = [
  { key: 'timeline', label: '证据链时间线' },
  { key: 'conflicts', label: '冲突处理' },
  { key: 'export', label: '导出报告' },
] as const

type TabKey = typeof TABS[number]['key']

export default function TraceReport() {
  const [activeTab, setActiveTab] = useState<TabKey>('timeline')
  const fetchRecords = useStore(s => s.fetchRecords)
  const fetchConflicts = useStore(s => s.fetchConflicts)
  const fetchParameterChanges = useStore(s => s.fetchParameterChanges)
  const fetchSources = useStore(s => s.fetchSources)
  const records = useStore(s => s.records)
  const sourcesByRecord = useStore(s => s.sourcesByRecord)
  const loading = useStore(s => s.loading)
  const error = useStore(s => s.error)

  useEffect(() => {
    fetchRecords(SCHEME_ID)
    fetchConflicts(SCHEME_ID)
    fetchParameterChanges(SCHEME_ID)
  }, [fetchRecords, fetchConflicts, fetchParameterChanges])

  useEffect(() => {
    for (const record of records) {
      if (!sourcesByRecord[record.id]) {
        fetchSources(record.id)
      }
    }
  }, [records, sourcesByRecord, fetchSources])

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-gray-100">
      <div className="border-b border-gray-700/50 px-6 pt-4">
        <h1 className="text-lg font-semibold text-gray-100 mb-4">追溯与报告</h1>
        <div className="flex gap-1">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-t-lg transition-colors',
                activeTab === tab.key
                  ? 'bg-gray-800/60 text-amber-400 border-b-2 border-amber-500'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/30',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        {loading && (
          <div className="absolute inset-0 bg-[#1a1a2e]/60 flex items-center justify-center z-10">
            <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        <div className={cn(activeTab !== 'timeline' && 'hidden')}>
          <Timeline />
        </div>
        <div className={cn(activeTab !== 'conflicts' && 'hidden')}>
          <ConflictCompare />
        </div>
        <div className={cn(activeTab !== 'export' && 'hidden')}>
          <ExportPanel />
        </div>
      </div>
    </div>
  )
}
