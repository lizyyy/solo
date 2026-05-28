import { useState, useEffect } from "react"
import {
  History,
  Trash2,
  RefreshCw,
  Upload,
  Clock,
  Users,
  AlertTriangle,
  Settings,
  Cpu,
  AlertCircle,
} from "lucide-react"
import { useAppStore } from "@/store"
import { loadHistory, deleteHistory, clearAllHistory } from "@/utils/history"
import type { HistoryRecord, GroupResult, Conflict, GraphNode, GraphEdge, CapacityConfig, AlgorithmConfig, BlacklistEntry } from "@/types"
import { ALGORITHM_TYPE_LABELS } from "@/types"
import { cn } from "@/lib/utils"

interface SnapshotData {
  groups: GroupResult[]
  conflicts: Conflict[]
  nodes: GraphNode[]
  edges: GraphEdge[]
  capacityConfig: CapacityConfig
  algorithmConfig: AlgorithmConfig
  blacklist: BlacklistEntry[]
  projectLabels: Record<string, string[]>
}

export default function HistoryPage() {
  const [records, setRecords] = useState<HistoryRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [clearing, setClearing] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const setGroups = useAppStore((s) => s.setGroups)
  const setConflicts = useAppStore((s) => s.setConflicts)
  const setNodes = useAppStore((s) => s.setNodes)
  const setEdges = useAppStore((s) => s.setEdges)
  const setBlacklist = useAppStore((s) => s.setBlacklist)
  const setProjectLabels = useAppStore((s) => s.setProjectLabels)
  const setCapacityConfig = useAppStore((s) => s.setCapacityConfig)
  const setAlgorithmConfig = useAppStore((s) => s.setAlgorithmConfig)
  const setDataLoaded = (loaded: boolean) => {
    useAppStore.setState({ dataLoaded: loaded })
  }
  const clearHistoryStore = useAppStore((s) => s.clearHistory)

  const fetchHistory = async () => {
    setLoading(true)
    try {
      const data = await loadHistory()
      setRecords(data)
      useAppStore.setState({ history: data })
    } catch (e) {
      console.error("加载历史失败", e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHistory()
  }, [])

  const formatTimestamp = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  const formatRelativeTime = (isoString: string) => {
    const now = new Date()
    const date = new Date(isoString)
    const diffMs = now.getTime() - date.getTime()
    const diffSec = Math.floor(diffMs / 1000)
    const diffMin = Math.floor(diffSec / 60)
    const diffHour = Math.floor(diffMin / 60)
    const diffDay = Math.floor(diffHour / 24)

    if (diffSec < 60) return `${diffSec}秒前`
    if (diffMin < 60) return `${diffMin}分钟前`
    if (diffHour < 24) return `${diffHour}小时前`
    if (diffDay < 7) return `${diffDay}天前`
    return formatTimestamp(isoString)
  }

  const handleLoadSnapshot = async (record: HistoryRecord) => {
    setLoadingId(record.id)
    try {
      const snapshot = JSON.parse(record.snapshot) as SnapshotData

      setGroups(snapshot.groups || [])
      setConflicts(snapshot.conflicts || [])
      setNodes(snapshot.nodes || [])
      setEdges(snapshot.edges || [])
      setBlacklist(snapshot.blacklist || [])
      setProjectLabels(snapshot.projectLabels || {})
      setCapacityConfig(snapshot.capacityConfig)
      setAlgorithmConfig(snapshot.algorithmConfig)
      setDataLoaded(true)
    } catch (e) {
      console.error("加载快照失败", e)
    } finally {
      setLoadingId(null)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await deleteHistory(id)
      const updated = records.filter((r) => r.id !== id)
      setRecords(updated)
      useAppStore.setState({ history: updated })
    } catch (e) {
      console.error("删除失败", e)
    } finally {
      setDeletingId(null)
    }
  }

  const handleClearAll = async () => {
    if (!window.confirm("确定要清空所有历史记录吗？此操作不可恢复。")) {
      return
    }
    setClearing(true)
    try {
      await clearAllHistory()
      setRecords([])
      clearHistoryStore()
    } catch (e) {
      console.error("清空失败", e)
    } finally {
      setClearing(false)
    }
  }

  const getConflictSeverityBadge = (count: number) => {
    if (count === 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
          <AlertCircle className="w-3 h-3" />
          无冲突
        </span>
      )
    }
    if (count < 3) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <AlertTriangle className="w-3 h-3" />
          {count} 条
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
        <AlertTriangle className="w-3 h-3" />
        {count} 条
      </span>
    )
  }

  return (
    <div className="h-full flex flex-col bg-slate-950/50">
      <div className="px-6 py-4 border-b border-slate-700/50 flex items-center justify-between bg-slate-900/80 backdrop-blur-sm">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <History className="w-5 h-5 text-purple-400" />
            历史记录
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            共 {records.length} 条历史快照
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchHistory}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 hover:text-white rounded-lg text-sm font-medium transition-colors border border-slate-700/50 disabled:opacity-50"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            刷新
          </button>
          {records.length > 0 && (
            <button
              onClick={handleClearAll}
              disabled={clearing}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg text-sm font-medium transition-colors border border-red-500/20 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              {clearing ? "清空中..." : "清空全部"}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <RefreshCw className="w-10 h-10 animate-spin mb-3 opacity-30" />
              <p>加载中...</p>
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <History className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-base mb-1">暂无历史记录</p>
              <p className="text-sm text-slate-500">
                在分组报告页点击「保存到历史」可以创建快照
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-w-4xl mx-auto">
              {records.map((record, index) => (
                <div
                  key={record.id}
                  className="bg-slate-900/80 border border-slate-700/50 rounded-xl overflow-hidden backdrop-blur-sm transition-all duration-200 hover:border-slate-600/50 animate-slide-up"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <div className="px-5 py-4">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Clock className="w-4 h-4 text-slate-500 flex-shrink-0" />
                          <span className="text-sm font-medium text-white">
                            {formatTimestamp(record.timestamp)}
                          </span>
                          <span className="text-xs text-slate-500">
                            ({formatRelativeTime(record.timestamp)})
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono truncate">
                          ID: {record.id}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleLoadSnapshot(record)}
                          disabled={loadingId === record.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white rounded-lg text-xs font-medium transition-colors"
                        >
                          {loadingId === record.id ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              加载中
                            </>
                          ) : (
                            <>
                              <Upload className="w-3.5 h-3.5" />
                              加载快照
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(record.id)}
                          disabled={deletingId === record.id}
                          className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-800/50 hover:bg-red-500/10 text-slate-400 hover:text-red-400 rounded-lg text-xs font-medium transition-colors border border-slate-700/50 hover:border-red-500/20"
                        >
                          {deletingId === record.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-3">
                      <div className="bg-slate-800/30 rounded-lg px-3 py-2 border border-slate-700/30">
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mb-1">
                          <Cpu className="w-3 h-3" />
                          算法
                        </div>
                        <div className="text-sm font-medium text-slate-200">
                          {ALGORITHM_TYPE_LABELS[record.algorithm]}
                        </div>
                      </div>

                      <div className="bg-slate-800/30 rounded-lg px-3 py-2 border border-slate-700/30">
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mb-1">
                          <Settings className="w-3 h-3" />
                          容量配置
                        </div>
                        <div className="text-sm font-medium text-slate-200">
                          {record.config.minSize} - {record.config.maxSize} 人
                        </div>
                      </div>

                      <div className="bg-slate-800/30 rounded-lg px-3 py-2 border border-slate-700/30">
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mb-1">
                          <Users className="w-3 h-3" />
                          分组数
                        </div>
                        <div className="text-sm font-medium text-blue-400">
                          {record.groupCount} 组
                        </div>
                      </div>

                      <div className="bg-slate-800/30 rounded-lg px-3 py-2 border border-slate-700/30">
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mb-1">
                          <AlertTriangle className="w-3 h-3" />
                          冲突数
                        </div>
                        <div>{getConflictSeverityBadge(record.conflictCount)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
