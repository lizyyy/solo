import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { CheckCircle, AlertTriangle, RefreshCcw, BarChart3 } from "lucide-react"
import { useMatrixStore } from "@/store/useMatrixStore"
import StatusBadge from "@/components/StatusBadge"
import StatCard from "@/components/StatCard"
import { demoRecords } from "@/data/demo"
import type { StatusFilter } from "@/types"

const filterTabs: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "smooth", label: "顺利" },
  { key: "pending_review", label: "待复核" },
  { key: "old_caliber_supplemented", label: "已补录" },
]

export default function Dashboard() {
  const navigate = useNavigate()
  const { initDemoData, setFilter, filter, getStats, getFilteredRecords } = useMatrixStore()
  const stats = getStats()
  const records = getFilteredRecords()

  useEffect(() => {
    initDemoData(demoRecords)
  }, [initDemoData])

  const statCards = [
    { label: "总计", value: stats.total, color: "#6366F1", icon: <BarChart3 className="h-5 w-5" /> },
    { label: "顺利", value: stats.smooth, color: "#00D68F", icon: <CheckCircle className="h-5 w-5" /> },
    { label: "待复核", value: stats.pendingReview, color: "#FFAA00", icon: <AlertTriangle className="h-5 w-5" /> },
    { label: "已补录", value: stats.oldCaliberSupplemented, color: "#FF6B6B", icon: <RefreshCcw className="h-5 w-5" /> },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">矩阵看板</h1>
        <p className="text-sm text-slate-400">资产减值迁徙矩阵总览</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {statCards.map((card) => (
          <StatCard key={card.label} label={card.label} value={card.value} color={card.color} icon={card.icon} />
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`rounded-full px-4 py-1.5 text-sm transition-all ${
              filter === tab.key
                ? "bg-white/10 text-white"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="w-full">
        <div className="bg-[#1A2B3C] rounded-xl border border-slate-700/50 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-[#0F1923]">
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider text-left">资产名称</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider text-left">资产代码</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider text-left">结算口径</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider text-left">原始口径</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider text-left">人工修正</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider text-left">处理状态</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider text-left">对账说明</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider text-left">操作</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id} className="border-t border-slate-700/30 hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 text-sm text-white font-medium">{record.assetName}</td>
                  <td className="px-4 py-3 text-sm font-mono text-slate-300">{record.assetCode}</td>
                  <td className="px-4 py-3 text-sm font-mono text-slate-300">{record.settlementCaliber}</td>
                  <td className="px-4 py-3 text-sm font-mono text-slate-300">{record.originalCaliber}</td>
                  <td className="px-4 py-3 text-sm">
                    {record.isManualCorrection ? (
                      <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                        <span className="text-red-400">是</span>
                      </span>
                    ) : (
                      <span className="text-slate-500">否</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <StatusBadge status={record.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400 truncate max-w-xs">{record.reconciliationNote}</td>
                  <td className="px-4 py-3 text-sm">
                    <button
                      onClick={() => navigate(`/record/${record.id}`)}
                      className="text-[#00D68F] hover:underline text-xs cursor-pointer"
                    >
                      查看详情
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {records.length === 0 && (
            <div className="py-12 text-center text-slate-500">暂无匹配记录</div>
          )}
        </div>
      </div>
    </div>
  )
}
