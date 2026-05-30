import { useState } from "react"
import { Link as RouterLink } from "react-router-dom"
import { ArrowLeft, History, Calendar, BarChart3 } from "lucide-react"
import { useStore } from "@/store/useStore"
import ReviewTimeline from "@/components/review/ReviewTimeline"
import ParamCompare from "@/components/review/ParamCompare"

export default function ReviewPage() {
  const auditLogs = useStore((s) => s.scene.auditLogs)
  const collisions = useStore((s) => s.scene.collisions)
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null)

  const selectedLog = auditLogs.find((log) => log.id === selectedLogId) || null

  const sortedLogs = [...auditLogs].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  )

  const resolvedCount = collisions.filter((c) => c.resolved).length
  const totalCollisions = collisions.length
  const resolutionRate =
    totalCollisions > 0 ? ((resolvedCount / totalCollisions) * 100).toFixed(1) : "0.0"

  const dateRange =
    auditLogs.length > 0
      ? `${new Date(sortedLogs[sortedLogs.length - 1].timestamp).toLocaleDateString("zh-CN")} - ${new Date(sortedLogs[0].timestamp).toLocaleDateString("zh-CN")}`
      : "无记录"

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white">
      <header className="h-12 bg-[#1a1a2e] border-b border-gray-800 flex items-center justify-between px-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <RouterLink
            to="/"
            className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition-colors"
          >
            <ArrowLeft size={14} />
            返回预演
          </RouterLink>
          <div className="flex items-center gap-2">
            <History className="text-red-500" size={18} />
            <h1 className="font-bold text-sm tracking-wide">月底复盘 · 修正历史回看</h1>
          </div>
        </div>

        <div className="text-xs text-gray-400 flex items-center gap-2">
          <Calendar size={12} />
          统计周期：{dateRange}
        </div>
      </header>

      <div className="p-6">
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-[#1a1a2e] border border-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">总修正次数</span>
              <BarChart3 size={16} className="text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-white">{auditLogs.length}</div>
          </div>
          <div className="bg-[#1a1a2e] border border-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">总碰撞数</span>
              <div className="w-2 h-2 rounded-full bg-red-500" />
            </div>
            <div className="text-2xl font-bold text-white">{totalCollisions}</div>
          </div>
          <div className="bg-[#1a1a2e] border border-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">已解决</span>
              <div className="w-2 h-2 rounded-full bg-green-500" />
            </div>
            <div className="text-2xl font-bold text-green-400">{resolvedCount}</div>
          </div>
          <div className="bg-[#1a1a2e] border border-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">解决率</span>
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
            </div>
            <div className="text-2xl font-bold text-yellow-400">{resolutionRate}%</div>
          </div>
        </div>

        <div className="bg-[#1a1a2e] border border-gray-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">修正时间线</h2>
            <div className="text-xs text-gray-500">
              点击记录查看详细对比与修正理由
            </div>
          </div>

          <div className="grid grid-cols-5 min-h-[600px]">
            <div className="col-span-2 border-r border-gray-800 p-4 overflow-y-auto max-h-[calc(100vh-280px)]">
              {sortedLogs.length > 0 ? (
                <ReviewTimeline
                  logs={sortedLogs}
                  selectedId={selectedLogId}
                  onSelect={setSelectedLogId}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <History size={48} className="mx-auto mb-2 opacity-20" />
                    <p className="text-sm">暂无修正记录</p>
                    <p className="text-xs text-gray-600 mt-1">
                      在舞台预演页人工修正参数后，将在此处显示
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="col-span-3 bg-[#14141f]">
              <ParamCompare log={selectedLog} />
            </div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-amber-900/20 border border-amber-800/50 rounded-lg">
          <h3 className="text-sm font-bold text-amber-400 mb-2">📋 复盘说明</h3>
          <div className="text-xs text-amber-200/80 space-y-1">
            <p>• 所有人工修正操作均完整记录旧值、新值、操作时间、操作人及修正理由</p>
            <p>• 导入、处理、回看、导出使用同一套 3D 舞台、灯位、碰撞检测口径，保证数据一致性</p>
            <p>• 导出的场景包包含完整审计日志，可跨设备迁移并保留完整修正历史</p>
            <p>• 每个元素保留 sourceRef 溯源链接，可一键跳转回原始来源文件中的对应位置</p>
          </div>
        </div>
      </div>
    </div>
  )
}
