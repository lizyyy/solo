import React, { useState } from "react"
import { useStore } from "@/store/useStore"
import StatusBadge from "@/components/StatusBadge"
import { type RecordStatus, STATUS_LABELS } from "@/types"
import { FileDown, ClipboardCheck, AlertCircle, Clock } from "lucide-react"

const CALIBER_TEXT: Record<RecordStatus, string> = {
  confirmed: "以下记录已完成授权文件、素材包和版式稿的核对，可直接进入交付流程。",
  pending: "以下记录存在未补齐文件，已标注待补项及预计补交时间，待补齐后可进入交付。",
  manual_corrected: "以下记录经人工修正，修正原因已注明，请重点复核后确认交付。",
}

const STATUS_ICON: Record<RecordStatus, React.ElementType> = {
  confirmed: ClipboardCheck,
  pending: Clock,
  manual_corrected: AlertCircle,
}

const GROUP_ORDER: RecordStatus[] = ["confirmed", "pending", "manual_corrected"]

function getNote(record: { status: RecordStatus; processingCaliber?: string; correctionNote?: string }) {
  if (record.status === "pending") return record.processingCaliber ?? ""
  if (record.status === "manual_corrected") return record.correctionNote ?? ""
  return "无异常"
}

export default function Delivery() {
  const records = useStore((s) => s.records)
  const [toast, setToast] = useState(false)

  const groups = GROUP_ORDER.map((status) => ({
    status,
    label: STATUS_LABELS[status],
    records: records.filter((r) => r.status === status),
    caliber: CALIBER_TEXT[status],
  }))

  const handleExport = () => {
    const lines = groups
      .filter((g) => g.records.length > 0)
      .flatMap((g) => [
        `【${g.label}】`,
        `处理口径：${g.caliber}`,
        ...g.records.map((r) => `  - ${r.title} | ${r.date} | ${getNote(r)}`),
        "",
      ])
    navigator.clipboard.writeText(["交付说明", ...lines].join("\n"))
    setToast(true)
    setTimeout(() => setToast(false), 2000)
  }

  return (
    <div className="min-h-full bg-[#F5F3EF] p-8">
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-semibold text-[#2D2D2D]">交付说明</h1>
        <p className="mt-1 text-sm text-[#8A8780]">供客户经理查看，含处理口径</p>
      </div>

      <div className="space-y-6">
        {groups.map((group) => {
          const Icon = STATUS_ICON[group.status]
          const color = group.status === "confirmed"
            ? "#7BA37E"
            : group.status === "pending"
            ? "#D4A843"
            : "#C75C5C"
          const bgColor = group.status === "confirmed"
            ? "rgba(123,163,126,0.08)"
            : group.status === "pending"
            ? "rgba(212,168,67,0.08)"
            : "rgba(199,92,92,0.08)"

          return (
            <div
              key={group.status}
              className="rounded-lg bg-white shadow-sm border-l-4"
              style={{ borderLeftColor: color }}
            >
              <div className="flex items-center gap-3 px-6 py-4 border-b border-[#E5E2DC]">
                <Icon size={20} style={{ color }} />
                <span className="text-base font-semibold" style={{ color }}>
                  {group.label}
                </span>
                <span className="text-xs text-[#8A8780]">{group.records.length} 条记录</span>
              </div>

              <div className="mx-6 my-4 rounded-md px-4 py-3 text-sm leading-relaxed" style={{ backgroundColor: bgColor, color }}>
                <span className="font-medium">处理口径：</span>{group.caliber}
              </div>

              {group.records.length > 0 && (
                <div className="px-6 pb-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#E5E2DC] text-left text-[#8A8780]">
                        <th className="pb-2 font-medium">标题</th>
                        <th className="pb-2 font-medium w-32">日期</th>
                        <th className="pb-2 font-medium">处理说明</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.records.map((r) => (
                        <tr key={r.id} className="border-b border-[#E5E2DC] last:border-0">
                          <td className="py-2.5 text-[#2D2D2D]">{r.title}</td>
                          <td className="py-2.5 text-[#8A8780]">{r.date}</td>
                          <td className="py-2.5 text-[#8A8780]">{getNote(r)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-8 flex justify-end">
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-medium text-white transition-colors"
          style={{ backgroundColor: "#4A6FA5" }}
        >
          <FileDown size={16} />
          导出交付说明
        </button>
      </div>

      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 rounded-lg bg-[#2D2D2D] px-5 py-3 text-sm text-white shadow-lg">
          已复制到剪贴板
        </div>
      )}
    </div>
  )
}
