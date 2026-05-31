import { useState, useEffect, useCallback, useRef } from "react"
import { useParams, Link } from "react-router-dom"
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Snowflake,
  CheckCircle2,
  Circle,
  Clock,
} from "lucide-react"
import { useReceiptStore } from "@/store/useReceiptStore"
import { STATUS_LABELS, STATUS_COLORS } from "@/types"
import type { ReceiptStatus } from "@/types"
import { cn } from "@/lib/utils"

const STATUS_OPTIONS: ReceiptStatus[] = [
  "reviewing",
  "approved",
  "rejected",
  "exception",
]

const TIMELINE_ICONS: Record<ReceiptStatus, typeof Circle> = {
  pending: Clock,
  reviewing: Circle,
  approved: CheckCircle2,
  rejected: AlertTriangle,
  exception: AlertTriangle,
}

const TIMELINE_DOT_COLORS: Record<ReceiptStatus, string> = {
  pending: "text-slate-400",
  reviewing: "text-blue-500",
  approved: "text-emerald-500",
  rejected: "text-red-500",
  exception: "text-amber-500",
}

function formatTime(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export default function ReceiptDetail() {
  const { id } = useParams<{ id: string }>()
  const init = useReceiptStore((s) => s.init)
  const getReceiptById = useReceiptStore((s) => s.getReceiptById)
  const updateTransactionField = useReceiptStore((s) => s.updateTransactionField)
  const updateReceiptStatus = useReceiptStore((s) => s.updateReceiptStatus)
  const releaseFrozen = useReceiptStore((s) => s.releaseFrozen)
  const getChangeHistory = useReceiptStore((s) => s.getChangeHistory)

  useEffect(() => {
    init()
  }, [init])

  const receipt = id ? getReceiptById(id) : undefined
  const changes = id ? getChangeHistory(id) : []

  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(true)
  const [editingCell, setEditingCell] = useState<{
    txId: string
    field: string
  } | null>(null)
  const [editValue, setEditValue] = useState("")
  const [statusRemark, setStatusRemark] = useState("")
  const [showStatusDialog, setShowStatusDialog] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<ReceiptStatus | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setStatusDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const handleStartEdit = useCallback(
    (txId: string, field: string, currentValue: string) => {
      setEditingCell({ txId, field })
      setEditValue(currentValue)
    },
    []
  )

  const handleFinishEdit = useCallback(() => {
    if (editingCell && id && editValue.trim() !== "") {
      const tx = receipt?.transactions.find((t) => t.id === editingCell.txId)
      const fieldData = tx?.fields[editingCell.field]
      if (fieldData && fieldData.value !== editValue) {
        updateTransactionField(id, editingCell.txId, editingCell.field, editValue)
      }
    }
    setEditingCell(null)
    setEditValue("")
  }, [editingCell, editValue, id, receipt, updateTransactionField])

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleFinishEdit()
      } else if (e.key === "Escape") {
        setEditingCell(null)
        setEditValue("")
      }
    },
    [handleFinishEdit]
  )

  const handleStatusChange = useCallback(
    (status: ReceiptStatus) => {
      setPendingStatus(status)
      setStatusRemark("")
      setShowStatusDialog(true)
      setStatusDropdownOpen(false)
    },
    []
  )

  const confirmStatusChange = useCallback(() => {
    if (id && pendingStatus) {
      updateReceiptStatus(id, pendingStatus, statusRemark || undefined)
    }
    setShowStatusDialog(false)
    setPendingStatus(null)
    setStatusRemark("")
  }, [id, pendingStatus, statusRemark, updateReceiptStatus])

  if (!receipt) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-50 text-zinc-500">
        <p>回执不存在或已删除</p>
      </div>
    )
  }

  const sortedTimeline = [...receipt.statusTimeline].reverse()

  return (
    <div className="min-h-screen bg-zinc-100">
      <header className="bg-zinc-900 text-zinc-100 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="p-1.5 rounded hover:bg-zinc-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-lg font-semibold tracking-wide font-mono">
            {receipt.id}
          </h1>
          <span
            className={cn(
              "px-2.5 py-0.5 rounded text-xs font-medium",
              STATUS_COLORS[receipt.status]
            )}
          >
            {STATUS_LABELS[receipt.status]}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {!receipt.frozenReleased && (
            <button
              onClick={() => id && releaseFrozen(id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-700 hover:bg-cyan-600 text-white text-sm rounded transition-colors"
            >
              <Snowflake className="w-4 h-4" />
              释放冻结
            </button>
          )}

          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 text-sm rounded transition-colors"
            >
              变更状态
              <ChevronDown
                className={cn(
                  "w-4 h-4 transition-transform",
                  statusDropdownOpen && "rotate-180"
                )}
              />
            </button>
            {statusDropdownOpen && (
              <div className="absolute right-0 mt-1 w-36 bg-white rounded shadow-lg border border-zinc-200 py-1 z-30">
                {STATUS_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 transition-colors",
                      receipt.status === s && "opacity-40 cursor-not-allowed"
                    )}
                    disabled={receipt.status === s}
                  >
                    <span className={cn("px-1.5 py-0.5 rounded text-xs font-medium", STATUS_COLORS[s])}>
                      {STATUS_LABELS[s]}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {showStatusDialog && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl w-96 p-6">
            <h3 className="text-base font-semibold text-zinc-900 mb-4">
              确认变更状态为{" "}
              <span className={cn("px-1.5 py-0.5 rounded text-xs font-medium", STATUS_COLORS[pendingStatus!])}>
                {STATUS_LABELS[pendingStatus!]}
              </span>
            </h3>
            <textarea
              value={statusRemark}
              onChange={(e) => setStatusRemark(e.target.value)}
              placeholder="备注（可选）"
              className="w-full border border-zinc-300 rounded px-3 py-2 text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowStatusDialog(false)}
                className="px-4 py-1.5 text-sm text-zinc-600 hover:text-zinc-800 transition-colors"
              >
                取消
              </button>
              <button
                onClick={confirmStatusChange}
                className="px-4 py-1.5 text-sm bg-zinc-900 text-white rounded hover:bg-zinc-700 transition-colors"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <aside className="lg:col-span-1">
            <div className="bg-white border border-zinc-200 rounded">
              <div className="px-4 py-3 border-b border-zinc-200 bg-zinc-50">
                <h2 className="text-sm font-semibold text-zinc-700">状态时间线</h2>
              </div>
              <div className="p-4">
                <div className="relative">
                  {sortedTimeline.map((event, i) => {
                    const Icon = TIMELINE_ICONS[event.status]
                    const dotColor = TIMELINE_DOT_COLORS[event.status]
                    return (
                      <div key={i} className="relative pb-6 last:pb-0">
                        {i < sortedTimeline.length - 1 && (
                          <div className="absolute left-[9px] top-[26px] bottom-0 w-px bg-zinc-200" />
                        )}
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            <Icon className={cn("w-[18px] h-[18px]", dotColor)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "px-1.5 py-0.5 rounded text-xs font-medium",
                                  STATUS_COLORS[event.status]
                                )}
                              >
                                {STATUS_LABELS[event.status]}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-400 mt-1 font-mono">
                              {formatTime(event.timestamp)}
                            </p>
                            <p className="text-xs text-zinc-500 mt-0.5">
                              {event.operator}
                            </p>
                            {event.remark && (
                              <p className="text-xs text-zinc-500 mt-0.5 italic">
                                {event.remark}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </aside>

          <section className="lg:col-span-2">
            <div className="bg-white border border-zinc-200 rounded">
              <div className="px-4 py-3 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-700">交易明细</h2>
                <span className="text-xs text-zinc-400">
                  双击当前值可编辑
                </span>
              </div>
              <div className="overflow-x-auto">
                {receipt.transactions.map((tx) => (
                  <table key={tx.id} className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-100 text-zinc-500 text-xs">
                        <th className="px-4 py-2.5 text-left font-medium w-32">
                          字段名
                        </th>
                        <th className="px-4 py-2.5 text-left font-medium">
                          当前值
                        </th>
                        <th className="px-4 py-2.5 text-left font-medium w-40">
                          原始值
                        </th>
                        <th className="px-4 py-2.5 text-left font-medium w-44">
                          修改时间
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(tx.fields).map(([fieldName, fieldData]) => {
                        const isEditing =
                          editingCell?.txId === tx.id &&
                          editingCell?.field === fieldName
                        return (
                          <tr
                            key={fieldName}
                            className={cn(
                              "border-b border-zinc-50",
                              fieldData.modified && "bg-amber-50"
                            )}
                          >
                            <td className="px-4 py-2.5 text-zinc-600 font-medium">
                              {fieldName}
                            </td>
                            <td
                              className="px-4 py-2.5"
                              onDoubleClick={() =>
                                !isEditing &&
                                handleStartEdit(tx.id, fieldName, fieldData.value)
                              }
                            >
                              {isEditing ? (
                                <input
                                  autoFocus
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={handleFinishEdit}
                                  onKeyDown={handleEditKeyDown}
                                  className="w-full px-2 py-1 border border-zinc-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 bg-white"
                                />
                              ) : (
                                <span
                                  className={cn(
                                    "cursor-default",
                                    fieldData.modified
                                      ? "text-amber-800 font-medium"
                                      : "text-zinc-800"
                                  )}
                                >
                                  {fieldData.value}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-zinc-400 font-mono text-xs">
                              {fieldData.originalValue}
                            </td>
                            <td className="px-4 py-2.5 text-zinc-400 text-xs font-mono">
                              {fieldData.modifiedAt
                                ? formatTime(fieldData.modifiedAt)
                                : "—"}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                ))}
              </div>
            </div>
          </section>
        </div>

        <div className="mt-6">
          <div className="bg-white border border-zinc-200 rounded">
            <button
              onClick={() => setHistoryOpen(!historyOpen)}
              className="w-full px-4 py-3 flex items-center justify-between bg-zinc-50 hover:bg-zinc-100 transition-colors rounded-t border-b border-zinc-200"
            >
              <h2 className="text-sm font-semibold text-zinc-700">
                变更记录 ({changes.length})
              </h2>
              {historyOpen ? (
                <ChevronUp className="w-4 h-4 text-zinc-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-zinc-400" />
              )}
            </button>
            {historyOpen && (
              <div className="p-4">
                {changes.length === 0 ? (
                  <p className="text-sm text-zinc-400 text-center py-4">
                    暂无变更记录
                  </p>
                ) : (
                  <div className="space-y-2">
                    {[...changes].reverse().map((record) => (
                      <div
                        key={record.id}
                        className="flex items-start gap-3 text-sm py-2 border-b border-zinc-50 last:border-0"
                      >
                        <span className="text-xs text-zinc-400 font-mono shrink-0 pt-0.5">
                          {formatTime(record.timestamp)}
                        </span>
                        <span className="text-zinc-500 shrink-0">
                          {record.operator}
                        </span>
                        <span className="text-zinc-700">
                          {record.fieldName}：
                          <span className="line-through text-zinc-400">
                            {record.oldValue}
                          </span>
                          {" → "}
                          <span className="text-amber-700 font-medium">
                            {record.newValue}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {receipt.status === "exception" && (
          <div className="mt-6 border border-amber-300 bg-amber-50 rounded p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-amber-800 mb-1">
                  异常说明
                </h3>
                <p className="text-sm text-amber-700">
                  {receipt.remark || "该回执存在异常，请核查变更记录并人工确认数据准确性。"}
                </p>
                {changes.length > 0 && (
                  <p className="text-xs text-amber-600 mt-2">
                    共 {changes.length} 条变更记录，请逐一核实字段修改是否合规。
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
