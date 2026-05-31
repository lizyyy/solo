import { useState } from "react"
import { useStore } from "@/store"
import { STATUS_LABELS, STATUS_COLORS, SOURCE_LABELS } from "@/types"
import type { RecordStatus } from "@/types"
import { Download, FileBarChart } from "lucide-react"

const tabs: { key: RecordStatus; label: string; color: string }[] = [
  { key: "confirmed", label: "已确认", color: "text-emerald-600 border-emerald-500" },
  { key: "pending", label: "待补", color: "text-rose-500 border-rose-400" },
  { key: "manual_corrected", label: "人工改过", color: "text-sky-500 border-sky-400" },
]

export default function WeeklyReportPage() {
  const { weeklyReportItems } = useStore()
  const [activeTab, setActiveTab] = useState<RecordStatus>("confirmed")

  const items = weeklyReportItems.filter((item) => item.category === activeTab)

  const handleExport = () => {
    const confirmed = weeklyReportItems.filter((i) => i.category === "confirmed")
    const pending = weeklyReportItems.filter((i) => i.category === "pending")
    const corrected = weeklyReportItems.filter((i) => i.category === "manual_corrected")

    const sectionHtml = (title: string, items: typeof weeklyReportItems, borderColor: string) =>
      `<div style="margin-bottom:32px"><h2 style="font-size:16px;font-weight:600;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid ${borderColor}">${title}（${items.length} 条）</h2><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:#f8fafc"><th style="text-align:left;padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#64748b;font-weight:500">来源</th><th style="text-align:left;padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#64748b;font-weight:500">摘要</th><th style="text-align:left;padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#64748b;font-weight:500">处理口径</th></tr></thead><tbody>${items
        .map(
          (i) =>
            `<tr><td style="padding:8px 12px;border-bottom:1px solid #f1f5f9">${SOURCE_LABELS[i.source]}</td><td style="padding:8px 12px;border-bottom:1px solid #f1f5f9">${i.summary}</td><td style="padding:8px 12px;border-bottom:1px solid #f1f5f9">${i.processingStance}</td></tr>`
        )
        .join("")}</tbody></table></div>`

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>质检周报 ${new Date().toISOString().slice(0, 10)}</title></head><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:900px;margin:0 auto;padding:32px"><h1 style="font-size:20px;font-weight:600;margin-bottom:4px">质检周报</h1><p style="color:#64748b;font-size:13px;margin-bottom:24px">报告周期：${new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)} — ${new Date().toISOString().slice(0, 10)}</p>${sectionHtml("已确认", confirmed, "#10b981")}${sectionHtml("待补", pending, "#f43f5e")}${sectionHtml("人工改过", corrected, "#0ea5e9")}</body></html>`

    const blob = new Blob([html], { type: "text/html" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `质检周报_${new Date().toISOString().slice(0, 10)}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">质检周报</h2>
          <p className="text-sm text-slate-500 mt-1">已确认 · 待补 · 人工改过 — 分开看，带处理口径</p>
        </div>
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 text-xs font-medium rounded transition-colors"
        >
          <Download size={14} />
          导出周报
        </button>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-100">
          {tabs.map((tab) => {
            const count = weeklyReportItems.filter((i) => i.category === tab.key).length
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === tab.key
                    ? `${tab.color} bg-slate-50/50`
                    : "text-slate-400 border-transparent hover:text-slate-600"
                }`}
              >
                {tab.label}
                <span className="ml-1.5 text-xs opacity-60">({count})</span>
              </button>
            )
          })}
        </div>

        <div className="p-5">
          {items.length === 0 ? (
            <div className="text-center py-12 text-sm text-slate-400">
              <FileBarChart size={32} className="mx-auto mb-2 opacity-30" />
              该分类下暂无记录
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="border border-slate-100 rounded-lg p-4 hover:bg-slate-50/30 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs text-slate-400">{SOURCE_LABELS[item.source]}</span>
                        <span className="text-slate-200">·</span>
                        <span className="text-xs font-mono text-slate-400">{item.timestamp.slice(0, 10)}</span>
                      </div>
                      <p className="text-sm text-slate-700">{item.summary}</p>
                    </div>
                    <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full border ${STATUS_COLORS[item.category]}`}>
                      {STATUS_LABELS[item.category]}
                    </span>
                  </div>
                  <div className="mt-3 bg-slate-50 rounded px-3 py-2">
                    <p className="text-xs text-slate-500 font-medium mb-0.5">处理口径</p>
                    <p className="text-xs text-slate-700 leading-relaxed">{item.processingStance}</p>
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
