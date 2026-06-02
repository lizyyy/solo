import { useEffect, useState } from 'react'
import { useLocationStore } from '@/stores/locationStore'
import { useFeedbackStore } from '@/stores/feedbackStore'
import { usePlanStore } from '@/stores/planStore'
import { useOperationLogStore } from '@/stores/operationLogStore'
import { usePhotoStore } from '@/stores/photoStore'
import { seedDemoData } from '@/services/seedData'
import {
  LayoutDashboard,
  RefreshCw,
  MapPin,
  MessageSquare,
  FileText,
  AlertTriangle,
  Clock,
  Database,
} from 'lucide-react'
import type { OperationType } from '@/types'

const typeBadgeColors: Record<OperationType, string> = {
  导入: 'bg-teal-500/20 text-teal-400',
  补录: 'bg-blue-500/20 text-blue-400',
  归并: 'bg-violet-500/20 text-violet-400',
  修改: 'bg-amber-500/20 text-amber-400',
  导出: 'bg-zinc-500/20 text-zinc-400',
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function Dashboard() {
  const locations = useLocationStore((s) => s.locations)
  const loadLocations = useLocationStore((s) => s.loadAll)
  const feedbacks = useFeedbackStore((s) => s.feedbacks)
  const loadFeedbacks = useFeedbackStore((s) => s.loadAll)
  const planVersions = usePlanStore((s) => s.planVersions)
  const loadPlans = usePlanStore((s) => s.loadAll)
  const logs = useOperationLogStore((s) => s.logs)
  const loadLogs = useOperationLogStore((s) => s.loadAll)
  const loadPhotos = usePhotoStore((s) => s.loadAll)
  const [seeding, setSeeding] = useState(false)

  const loadAll = () => {
    loadLocations()
    loadFeedbacks()
    loadPlans()
    loadLogs()
    loadPhotos()
  }

  useEffect(() => {
    loadAll()
  }, [])

  const handleSeed = async () => {
    setSeeding(true)
    try {
      await seedDemoData()
      loadAll()
    } finally {
      setSeeding(false)
    }
  }

  const activeLocations = locations.filter((l) => l.mergeStatus !== '已归并')
  const mergedCount = locations.length - activeLocations.length
  const pendingFeedbacks = feedbacks.filter((f) => f.status === '待处理').length
  const latestPlan = [...planVersions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )[0]
  const exceptionCount = locations.filter((l) => l.isException).length
  const anomalyCount = locations.filter((l) => l.mergeStatus === '疑似重复').length

  const totalLocations = locations.length
  const dirtyRate = totalLocations > 0
    ? ((locations.filter((l) => l.isException).length / totalLocations) * 100)
    : 0
  const unmergedDuplicateCount = locations.filter((l) => l.mergeStatus === '疑似重复').length
  const missingFieldCount = locations.filter((l) => !l.address || !l.canonicalName).length
  const missingFieldRate = totalLocations > 0
    ? ((missingFieldCount / totalLocations) * 100)
    : 0

  const recentLogs = [...logs]
    .sort((a, b) => new Date(b.operatedAt).getTime() - new Date(a.operatedAt).getTime())
    .slice(0, 10)

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="w-6 h-6 text-zinc-400" />
            <h1 className="text-2xl font-bold">数据看板</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600/20 hover:bg-teal-600/30 border border-teal-600/40 rounded-lg text-sm text-teal-400 transition-colors disabled:opacity-50"
            >
              <Database className="w-4 h-4" />
              {seeding ? '加载中...' : '加载演示数据'}
            </button>
            <button
              onClick={loadAll}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-sm transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              刷新
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center gap-2 text-zinc-400 text-sm mb-3">
              <MapPin className="w-4 h-4" />
              点位总数
            </div>
            <div className="text-3xl font-bold">
              {activeLocations.length}
              {mergedCount > 0 && (
                <span className="text-sm font-normal text-zinc-500 ml-2">
                  (归并前 {locations.length})
                </span>
              )}
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center gap-2 text-zinc-400 text-sm mb-3">
              <MessageSquare className="w-4 h-4" />
              待处理反馈
            </div>
            <div className="text-3xl font-bold text-amber-500">{pendingFeedbacks}</div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center gap-2 text-zinc-400 text-sm mb-3">
              <FileText className="w-4 h-4" />
              当前方案版本
            </div>
            <div className="text-3xl font-bold">
              {latestPlan ? latestPlan.versionName : '暂无'}
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center gap-2 text-zinc-400 text-sm mb-3">
              <AlertTriangle className="w-4 h-4" />
              例外/异常
            </div>
            <div className="text-3xl font-bold text-red-500">
              {exceptionCount + anomalyCount}
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold mb-4">数据健康度</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-zinc-400">脏数据占比</span>
                <span className={dirtyRate > 10 ? 'text-red-400' : dirtyRate > 0 ? 'text-amber-400' : 'text-green-400'}>
                  {dirtyRate.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${dirtyRate > 10 ? 'bg-red-500' : dirtyRate > 0 ? 'bg-amber-500' : 'bg-green-500'}`}
                  style={{ width: `${Math.min(dirtyRate, 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-zinc-400">未归并疑似重复</span>
                <span className={unmergedDuplicateCount > 0 ? 'text-amber-400' : 'text-green-400'}>
                  {unmergedDuplicateCount} 条
                </span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${unmergedDuplicateCount > 0 ? 'bg-amber-500' : 'bg-green-500'}`}
                  style={{
                    width: totalLocations > 0
                      ? `${(unmergedDuplicateCount / totalLocations) * 100}%`
                      : '0%',
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-zinc-400">缺失字段</span>
                <span className={missingFieldRate > 10 ? 'text-red-400' : missingFieldRate > 0 ? 'text-amber-400' : 'text-green-400'}>
                  {missingFieldCount} 条 ({missingFieldRate.toFixed(1)}%)
                </span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${missingFieldRate > 10 ? 'bg-red-500' : missingFieldRate > 0 ? 'bg-amber-500' : 'bg-green-500'}`}
                  style={{ width: `${Math.min(missingFieldRate, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold mb-4">最近操作</h2>
          {recentLogs.length === 0 ? (
            <div className="text-zinc-500 text-sm text-center py-8">暂无操作记录</div>
          ) : (
            <div className="space-y-3">
              {recentLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3">
                  <Clock className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
                  <span className="text-xs text-zinc-500 whitespace-nowrap mt-0.5">
                    {formatTimestamp(log.operatedAt)}
                  </span>
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${typeBadgeColors[log.type]}`}
                  >
                    {log.type}
                  </span>
                  <span className="text-sm text-zinc-300">{log.summary}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
