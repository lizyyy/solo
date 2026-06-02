import { useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '@/store/useStore'
import { cn } from '@/lib/utils'
import { Sparkles, Search, Download, FlaskConical, History } from 'lucide-react'
import TrackList from '@/components/TrackList'
import TrackDetail from '@/components/TrackDetail'
import type { TrackStatus } from '@/types'

const statusFilters: { value: TrackStatus | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待处理' },
  { value: 'needs_review', label: '需人工确认' },
  { value: 'passed', label: '已通过' },
  { value: 'old_caliber', label: '已标记旧口径' },
]

export default function Home() {
  const tracks = useStore((s) => s.tracks)
  const statusFilter = useStore((s) => s.statusFilter)
  const searchQuery = useStore((s) => s.searchQuery)
  const isLoading = useStore((s) => s.isLoading)
  const isCleaning = useStore((s) => s.isCleaning)
  const fetchTracks = useStore((s) => s.fetchTracks)
  const setStatusFilter = useStore((s) => s.setStatusFilter)
  const setSearchQuery = useStore((s) => s.setSearchQuery)
  const runCleaning = useStore((s) => s.runCleaning)
  const importSampleData = useStore((s) => s.importSampleData)

  useEffect(() => {
    fetchTracks()
  }, [fetchTracks])

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      fetchTracks()
    },
    [fetchTracks],
  )

  const statusCounts = tracks.reduce(
    (acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  return (
    <div className="flex h-screen flex-col bg-[#0f172a]">
      <header className="shrink-0 border-b border-slate-700/50 bg-[#0f172a] px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-100">
              剧院返场曲投票清洗
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              串联文件、曲目、批注与异常原因，清洗结果不靠猜
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/audit"
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:border-slate-600 hover:text-slate-300"
            >
              <History className="h-3.5 w-3.5" />
              审计日志
            </Link>
            <button
              onClick={importSampleData}
              className="flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-slate-500 hover:bg-slate-700"
            >
              <Download className="h-3.5 w-3.5" />
              导入样例
            </button>
            <button
              onClick={runCleaning}
              disabled={isCleaning || tracks.length === 0}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                isCleaning || tracks.length === 0
                  ? 'cursor-not-allowed bg-amber-600/10 text-amber-600/50'
                  : 'bg-amber-600/20 text-amber-400 hover:bg-amber-600/30',
              )}
            >
              <Sparkles className={cn('h-3.5 w-3.5', isCleaning && 'animate-spin')} />
              {isCleaning ? '清洗中...' : '执行清洗'}
            </button>
          </div>
        </div>
      </header>

      <div className="flex shrink-0 items-center gap-4 border-b border-slate-700/50 px-6 py-3">
        <div className="flex items-center gap-1">
          {statusFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                statusFilter === f.value
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-300',
              )}
            >
              {f.label}
              {f.value !== 'all' && statusCounts[f.value] !== undefined && (
                <span className="ml-1 text-[10px] opacity-70">
                  {statusCounts[f.value]}
                </span>
              )}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearch} className="ml-auto flex items-center">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索曲目名..."
              className="w-48 rounded-lg border border-slate-700 bg-slate-800/50 py-1.5 pl-8 pr-3 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-amber-500/50"
            />
          </div>
        </form>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <FlaskConical className="h-6 w-6 animate-pulse text-amber-400" />
              <span className="ml-2 text-sm text-slate-400">加载中...</span>
            </div>
          ) : (
            <TrackList />
          )}
        </div>

        <div className="w-[420px] shrink-0 overflow-y-auto border-l border-slate-700/50 bg-[#0f172a] p-4">
          <TrackDetail />
        </div>
      </div>
    </div>
  )
}
