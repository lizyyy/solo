import { Link } from "react-router-dom"
import { AlertTriangle, Pause, Clock, FileEdit, AlertCircle, CheckCircle } from "lucide-react"
import type { ExceptionItem, ExceptionType } from "@/types"
import { formatDateTime } from "@/utils"

const typeConfig: Record<ExceptionType, { icon: typeof AlertTriangle; color: string; label: string }> = {
  "主动暂停": { icon: Pause, color: "text-warning bg-warning/10", label: "主动暂停" },
  "边界分数": { icon: AlertTriangle, color: "text-warning bg-warning/10", label: "边界分数" },
  "操作超时": { icon: Clock, color: "text-danger bg-danger/10", label: "操作超时" },
  "规则未理解": { icon: AlertCircle, color: "text-danger bg-danger/10", label: "规则未理解" },
  "补录调整": { icon: FileEdit, color: "text-brand-400 bg-brand-400/10", label: "补录调整" },
  "需人工确认": { icon: CheckCircle, color: "text-warning bg-warning/10", label: "需人工确认" },
}

interface ExceptionTableProps {
  exceptions: ExceptionItem[]
}

export default function ExceptionTable({ exceptions }: ExceptionTableProps) {
  if (exceptions.length === 0) {
    return (
      <div className="card p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-success" />
        </div>
        <p className="text-slate-400">暂无异常记录，一切顺利！</p>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-700/30">
            <tr>
              <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">类型</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">详情</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">步骤</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">时间</th>
              <th className="text-right px-6 py-4 text-sm font-medium text-slate-400">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {exceptions.map((exception, idx) => {
              const cfg = typeConfig[exception.type]
              const Icon = cfg.icon
              return (
                <tr
                  key={idx}
                  className="hover:bg-slate-700/20 transition-colors"
                >
                  <td className="px-6 py-4">
                    <span className={`tag gap-1 ${cfg.color}`}>
                      <Icon className="w-3 h-3" />
                      {cfg.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-300 max-w-md">
                    {exception.description}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-400">
                    {exception.stepIndex !== undefined
                      ? `第 ${exception.stepIndex + 1} 步`
                      : "-"}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-400">
                    {formatDateTime(exception.timestamp)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      to={`/history/${exception.recordId}`}
                      className="text-brand-400 hover:text-brand-300 text-sm font-medium"
                    >
                      查看记录 →
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
