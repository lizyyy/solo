import { useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { FileDown, ArrowLeft, CheckCircle, Clock, Eye, Download, AlertTriangle } from "lucide-react"
import { useAlertStore } from "@/store/alertStore"
import type { AlertStatus } from "@/types/alert"

const STATUS_CONFIG: { status: AlertStatus; label: string; icon: React.ReactNode; color: string; border: string; bg: string; badge: string }[] = [
  {
    status: "processed",
    label: "已处理",
    icon: <CheckCircle className="w-5 h-5" />,
    color: "text-emerald-400",
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/10",
    badge: "bg-emerald-500/20 text-emerald-300",
  },
  {
    status: "pending",
    label: "待核实",
    icon: <Clock className="w-5 h-5" />,
    color: "text-amber-400",
    border: "border-amber-500/30",
    bg: "bg-amber-500/10",
    badge: "bg-amber-500/20 text-amber-300",
  },
  {
    status: "recheck",
    label: "需现场复看",
    icon: <Eye className="w-5 h-5" />,
    color: "text-red-400",
    border: "border-red-500/30",
    bg: "bg-red-500/10",
    badge: "bg-red-500/20 text-red-300",
  },
]

function handleExport(status: AlertStatus, label: string) {
  const csv = useAlertStore.getState().exportCSV(status)
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  const date = new Date().toISOString().slice(0, 10)
  a.href = url
  a.download = `夜间经济人流预警_${label}_${date}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function ExportPage() {
  const navigate = useNavigate()
  const alerts = useAlertStore((s) => s.alerts)

  const stats = useMemo(() => ({
    processed: alerts.filter((a) => a.status === "processed").length,
    pending: alerts.filter((a) => a.status === "pending").length,
    recheck: alerts.filter((a) => a.status === "recheck").length,
  }), [alerts])

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white p-6">
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>返回地图</span>
        </button>
        <div className="flex items-center gap-3">
          <FileDown className="w-6 h-6 text-[#4a90d9]" />
          <h1 className="text-2xl font-bold">导出夜间经济人流预警</h1>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {STATUS_CONFIG.map((cfg) => {
          const filtered = alerts.filter((a) => a.status === cfg.status)
          const count = stats[cfg.status]
          const preview = filtered.slice(0, 5)

          return (
            <div
              key={cfg.status}
              className={`rounded-xl border ${cfg.border} ${cfg.bg} p-5 flex flex-col`}
            >
              <div className="flex items-center gap-3 mb-4">
                <span className={cfg.color}>{cfg.icon}</span>
                <h2 className="text-lg font-semibold">{cfg.label}</h2>
                <span className={`font-mono text-sm px-2 py-0.5 rounded-full ${cfg.badge}`}>
                  {count}
                </span>
              </div>

              <div className="flex-1 overflow-hidden mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 border-b border-white/10">
                      <th className="text-left pb-2 font-normal">名称</th>
                      <th className="text-left pb-2 font-normal">来源编号</th>
                      <th className="text-left pb-2 font-normal">更新时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((a) => (
                      <tr key={a.id} className="border-b border-white/5">
                        <td className="py-2 font-mono text-xs">
                          <span className="flex items-center gap-1">
                            {a.name}
                            {a.isOldCaliber && (
                              <span className="text-[10px] px-1 py-0.5 rounded bg-yellow-500/20 text-yellow-300">
                                旧口径
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="py-2 font-mono text-xs text-gray-300">
                          {a.sources[0]?.referenceNo || "-"}
                        </td>
                        <td className="py-2 font-mono text-xs text-gray-300">
                          {a.updatedAt.slice(0, 16).replace("T", " ")}
                        </td>
                      </tr>
                    ))}
                    {preview.length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-4 text-center text-gray-500 text-xs">
                          暂无数据
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <button
                onClick={() => handleExport(cfg.status, cfg.label)}
                disabled={count === 0}
                className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-lg font-medium text-sm transition-colors
                  ${count === 0 ? "bg-white/5 text-gray-600 cursor-not-allowed" : `${cfg.bg} ${cfg.color} hover:opacity-80`}`}
              >
                <Download className="w-4 h-4" />
                导出 CSV
              </button>
            </div>
          )
        })}
      </div>

      <div className="mt-6 flex items-center gap-2 text-gray-500 text-xs">
        <AlertTriangle className="w-4 h-4" />
        <span>导出文件包含 BOM 头以确保 Excel 正确显示中文</span>
      </div>
    </div>
  )
}
