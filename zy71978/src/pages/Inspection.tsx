import { useState, useCallback } from "react"
import { useStore } from "@/store"
import { STATUS_LABELS, STATUS_COLORS } from "@/types"
import type { InspectionRecord, RecordStatus } from "@/types"
import { Rocket, ClipboardCheck, Headphones, Clock, Copy, AlertTriangle, ChevronRight, Upload, X } from "lucide-react"

const iconMap: Record<string, React.ReactNode> = {
  Rocket: <Rocket size={14} />,
  ClipboardCheck: <ClipboardCheck size={14} />,
  Headphones: <Headphones size={14} />,
}

const statusFilterOptions: { value: RecordStatus; label: string }[] = [
  { value: "confirmed", label: "已确认" },
  { value: "pending", label: "待补" },
  { value: "manual_corrected", label: "人工改过" },
]

function formatDate(ts: string) {
  const d = new Date(ts)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

function RecordDrawer({ record, onClose }: { record: InspectionRecord; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-[480px] bg-white shadow-xl h-full overflow-auto">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">记录详情</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        <div className="p-6">
          <div className="mb-5">
            <span className={`inline-block text-[11px] px-2 py-0.5 rounded-full border ${STATUS_COLORS[record.currentStatus]}`}>
              {STATUS_LABELS[record.currentStatus]}
            </span>
          </div>

          <div className="space-y-4 text-sm">
            <div className="flex gap-8">
              <div>
                <span className="text-slate-400 text-xs">来源系统</span>
                <p className="text-slate-700 mt-0.5 flex items-center gap-1.5">
                  {iconMap[record.sourceIcon]}
                  {record.sourceSystem}
                </p>
              </div>
              <div>
                <span className="text-slate-400 text-xs">提示词版本</span>
                <p className="text-slate-700 mt-0.5 font-mono">{record.promptVersion}</p>
              </div>
            </div>
            <div className="flex gap-8">
              <div>
                <span className="text-slate-400 text-xs">最近修改人</span>
                <p className="text-slate-700 mt-0.5">{record.modifier}</p>
              </div>
              <div>
                <span className="text-slate-400 text-xs">修改时间</span>
                <p className="text-slate-700 mt-0.5 font-mono text-xs">{formatDate(record.modifiedAt)}</p>
              </div>
            </div>
            {record.pendingReason && (
              <div>
                <span className="text-slate-400 text-xs">待处理原因</span>
                <div className="mt-1 flex items-start gap-1.5 text-amber-700 bg-amber-50 px-3 py-2 rounded text-xs">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                  {record.pendingReason}
                </div>
              </div>
            )}
            <div className="flex gap-3">
              {record.isLateAttachment && (
                <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 bg-amber-50 px-2 py-1 rounded">
                  <Clock size={10} /> 晚到附件
                </span>
              )}
              {record.isDuplicate && (
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 bg-slate-100 px-2 py-1 rounded">
                  <Copy size={10} /> 重复项
                </span>
              )}
              {record.isManualCorrection && (
                <span className="inline-flex items-center gap-1 text-[11px] text-sky-600 bg-sky-50 px-2 py-1 rounded">
                  人工更正
                </span>
              )}
            </div>
          </div>

          <div className="mt-8">
            <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">变更历史</h4>
            <div className="space-y-0">
              {record.changeHistory.map((entry, i) => (
                <div key={i} className="relative pl-6 pb-4 last:pb-0">
                  <div className="absolute left-1.5 top-1.5 w-2 h-2 rounded-full bg-slate-300" />
                  {i < record.changeHistory.length - 1 && (
                    <div className="absolute left-[9px] top-4 bottom-0 w-px bg-slate-200" />
                  )}
                  <div className="text-xs">
                    <div className="flex items-center gap-2 text-slate-400 font-mono">
                      {formatDate(entry.timestamp)}
                      <span className="text-slate-300">·</span>
                      <span className="text-slate-600">{entry.operator}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 text-slate-600">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] border ${STATUS_COLORS[entry.fromStatus]}`}>
                        {STATUS_LABELS[entry.fromStatus]}
                      </span>
                      <ChevronRight size={10} className="text-slate-300" />
                      <span className={`px-1.5 py-0.5 rounded text-[10px] border ${STATUS_COLORS[entry.toStatus]}`}>
                        {STATUS_LABELS[entry.toStatus]}
                      </span>
                    </div>
                    <p className="mt-1 text-slate-500">{entry.remark}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function DataIngestPanel() {
  const { ingestData } = useStore()
  const [ingesting, setIngesting] = useState(false)
  const [result, setResult] = useState<{ total: number; late: number; dup: number; corrected: number } | null>(null)

  const simulateIngest = useCallback(() => {
    setIngesting(true)
    setResult(null)
    setTimeout(() => {
      const newRecords: InspectionRecord[] = [
        {
          id: `insp-ingest-${Date.now()}-1`,
          sourceSystem: "质检系统",
          sourceIcon: "ClipboardCheck",
          promptVersion: "v3.2.2",
          currentStatus: "pending",
          modifier: "系统",
          modifiedAt: new Date().toISOString(),
          pendingReason: "新增抽检数据待审核",
          changeHistory: [
            { timestamp: new Date().toISOString(), operator: "系统", fromStatus: "pending", toStatus: "pending", remark: "数据包摄入，自动创建" },
          ],
        },
        {
          id: `insp-ingest-${Date.now()}-2`,
          sourceSystem: "客服工单系统",
          sourceIcon: "Headphones",
          promptVersion: "v3.2.1",
          currentStatus: "pending",
          modifier: "系统",
          modifiedAt: new Date().toISOString(),
          isLateAttachment: true,
          pendingReason: "晚到附件，完整性校验中",
          changeHistory: [
            { timestamp: new Date().toISOString(), operator: "系统", fromStatus: "pending", toStatus: "pending", remark: "晚到附件摄入" },
          ],
        },
        {
          id: `insp-ingest-${Date.now()}-3`,
          sourceSystem: "灰度发布平台",
          sourceIcon: "Rocket",
          promptVersion: "v3.2.1",
          currentStatus: "confirmed",
          modifier: "系统",
          modifiedAt: new Date().toISOString(),
          isDuplicate: true,
          changeHistory: [
            { timestamp: new Date().toISOString(), operator: "系统", fromStatus: "pending", toStatus: "confirmed", remark: "检测到重复记录，已自动标记" },
          ],
        },
        {
          id: `insp-ingest-${Date.now()}-4`,
          sourceSystem: "质检系统",
          sourceIcon: "ClipboardCheck",
          promptVersion: "v3.2.2",
          currentStatus: "manual_corrected",
          modifier: "赵丽",
          modifiedAt: new Date().toISOString(),
          isManualCorrection: true,
          changeHistory: [
            { timestamp: new Date().toISOString(), operator: "赵丽", fromStatus: "pending", toStatus: "manual_corrected", remark: "人工更正：自动分类错误，已修正" },
          ],
        },
      ]
      ingestData(newRecords)
      setResult({ total: 4, late: 1, dup: 1, corrected: 1 })
      setIngesting(false)
    }, 1200)
  }, [ingestData])

  return (
    <div className="bg-slate-800 rounded-lg p-5 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Upload size={16} className="text-amber-400" />
        <h3 className="text-sm font-medium text-white">数据摄入</h3>
      </div>
      <p className="text-xs text-slate-400 mb-4">模拟摄入一包混合材料（含正常记录、晚到附件、重复项和人工更正）</p>
      <button
        onClick={simulateIngest}
        disabled={ingesting}
        className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/50 text-slate-900 text-xs font-medium rounded transition-colors"
      >
        {ingesting ? "摄入中…" : "摄入数据包"}
      </button>
      {result && (
        <div className="mt-4 grid grid-cols-4 gap-3">
          <div className="bg-slate-700/50 rounded px-3 py-2">
            <p className="text-lg font-semibold text-white">{result.total}</p>
            <p className="text-[10px] text-slate-400">总记录</p>
          </div>
          <div className="bg-slate-700/50 rounded px-3 py-2">
            <p className="text-lg font-semibold text-amber-400">{result.late}</p>
            <p className="text-[10px] text-slate-400">晚到附件</p>
          </div>
          <div className="bg-slate-700/50 rounded px-3 py-2">
            <p className="text-lg font-semibold text-slate-300">{result.dup}</p>
            <p className="text-[10px] text-slate-400">重复项</p>
          </div>
          <div className="bg-slate-700/50 rounded px-3 py-2">
            <p className="text-lg font-semibold text-sky-400">{result.corrected}</p>
            <p className="text-[10px] text-slate-400">人工更正</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default function InspectionPage() {
  const { inspectionRecords, selectedInspectionId, setSelectedInspectionId } = useStore()
  const [statusFilter, setStatusFilter] = useState<RecordStatus[]>([])

  const toggleStatus = (s: RecordStatus) => {
    setStatusFilter((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])
  }

  const filtered = inspectionRecords.filter((r) => {
    if (statusFilter.length > 0 && !statusFilter.includes(r.currentStatus)) return false
    return true
  })

  const selectedRecord = selectedInspectionId ? inspectionRecords.find((r) => r.id === selectedInspectionId) : null

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-800">提示词版本巡检</h2>
        <p className="text-sm text-slate-500 mt-1">每条记录：来源 · 状态 · 修改人 · 待处理原因</p>
      </div>

      <DataIngestPanel />

      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs text-slate-400 font-medium">状态筛选</span>
        {statusFilterOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => toggleStatus(opt.value)}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border transition-colors ${
              statusFilter.includes(opt.value)
                ? STATUS_COLORS[opt.value] + " border"
                : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-400">来源</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-400">版本</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-400">状态</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-400">修改人</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-400">待处理原因</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-400">标记</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((record) => (
              <tr
                key={record.id}
                onClick={() => setSelectedInspectionId(record.id)}
                className="border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    {iconMap[record.sourceIcon]}
                    <span className="text-xs">{record.sourceSystem}</span>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-700">{record.promptVersion}</td>
                <td className="px-4 py-3">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full border ${STATUS_COLORS[record.currentStatus]}`}>
                    {STATUS_LABELS[record.currentStatus]}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">{record.modifier}</td>
                <td className="px-4 py-3 text-xs text-slate-400 max-w-[200px] truncate">
                  {record.pendingReason || "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {record.isLateAttachment && <Clock size={12} className="text-amber-500" />}
                    {record.isDuplicate && <Copy size={12} className="text-slate-400" />}
                    {record.isManualCorrection && <AlertTriangle size={12} className="text-sky-400" />}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <ChevronRight size={14} className="text-slate-300" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-sm text-slate-400">无匹配记录</div>
        )}
      </div>

      {selectedRecord && (
        <RecordDrawer record={selectedRecord} onClose={() => setSelectedInspectionId(null)} />
      )}
    </div>
  )
}
