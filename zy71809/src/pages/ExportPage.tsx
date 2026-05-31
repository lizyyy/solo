import { useState, useEffect, useMemo, useCallback } from "react"
import { useReceiptStore } from "@/store/useReceiptStore"
import { cn } from "@/lib/utils"
import { Download, FileCheck, AlertTriangle, CheckCircle2, Shield, Clock } from "lucide-react"
import type { Receipt, ReceiptStatus, ConsistencyResult } from "@/types"
import { STATUS_LABELS, STATUS_COLORS } from "@/types"

const STATUS_OPTIONS: { value: ReceiptStatus | "all"; label: string }[] = [
  { value: "all", label: "全部状态" },
  { value: "pending", label: "待复核" },
  { value: "reviewing", label: "复核中" },
  { value: "approved", label: "已通过" },
  { value: "rejected", label: "已驳回" },
  { value: "exception", label: "异常" },
]

function hasModifiedFields(receipt: Receipt): boolean {
  return receipt.transactions.some((tx) =>
    Object.values(tx.fields).some((f) => f.modified)
  )
}

function formatAmount(n: number): string {
  return n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => n.toString().padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function generateCSV(receipts: Receipt[]): string {
  const header = "渠道名称,交易流水号,金额,状态,备注,导出时间"
  const now = formatDateTime(new Date().toISOString())
  const rows = receipts.map((r) =>
    [
      r.channelName,
      r.transactionNo,
      r.amount.toFixed(2),
      STATUS_LABELS[r.status],
      r.remark,
      now,
    ]
      .map((v) => `"${v}"`)
      .join(",")
  )
  return [header, ...rows].join("\n")
}

function downloadCSV(csv: string, filename: string) {
  const bom = "\uFEFF"
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function ExportPage() {
  const receipts = useReceiptStore((s) => s.receipts)
  const validateExportConsistency = useReceiptStore((s) => s.validateExportConsistency)
  const exportChecklist = useReceiptStore((s) => s.exportChecklist)
  const exportRecords = useReceiptStore((s) => s.exportRecords)
  const init = useReceiptStore((s) => s.init)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState<ReceiptStatus | "all">("all")
  const [consistencyResult, setConsistencyResult] = useState<ConsistencyResult | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    init()
  }, [init])

  const filteredReceipts = useMemo(() => {
    if (statusFilter === "all") return receipts
    return receipts.filter((r) => r.status === statusFilter)
  }, [receipts, statusFilter])

  const selectedReceipts = useMemo(
    () => receipts.filter((r) => selectedIds.has(r.id)),
    [receipts, selectedIds]
  )

  const allFilteredSelected = filteredReceipts.length > 0 && filteredReceipts.every((r) => selectedIds.has(r.id))

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setConsistencyResult(null)
  }, [])

  const toggleSelectAll = useCallback(() => {
    if (allFilteredSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredReceipts.map((r) => r.id)))
    }
    setConsistencyResult(null)
  }, [allFilteredSelected, filteredReceipts])

  const handleValidate = useCallback(() => {
    const result = validateExportConsistency(Array.from(selectedIds))
    setConsistencyResult(result)
  }, [validateExportConsistency, selectedIds])

  const handleExport = useCallback(() => {
    const ids = Array.from(selectedIds)
    exportChecklist(ids)
    const csv = generateCSV(selectedReceipts)
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "")
    downloadCSV(csv, `复核清单_${timestamp}.csv`)
    setToast(`成功导出 ${ids.length} 条记录`)
    setSelectedIds(new Set())
    setConsistencyResult(null)
    setTimeout(() => setToast(null), 3000)
  }, [exportChecklist, selectedIds, selectedReceipts])

  const canExport = consistencyResult !== null && consistencyResult.consistent && selectedIds.size > 0

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-800">
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded shadow-lg text-sm font-medium animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4" />
          {toast}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <header className="flex items-center justify-between border-b border-zinc-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-zinc-800 rounded flex items-center justify-center">
              <Download className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">导出复核清单</h1>
              <p className="text-xs text-zinc-500 mt-0.5">选择回执 → 校验一致性 → 导出清单</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Shield className="w-3.5 h-3.5" />
            <span>共 {receipts.length} 条记录</span>
          </div>
        </header>

        <section className="border border-zinc-200 bg-white rounded">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 bg-zinc-50/60">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold">选择回执</h2>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as ReceiptStatus | "all")}
                className="text-xs border border-zinc-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-zinc-400"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={toggleSelectAll}
                className="text-xs text-zinc-600 hover:text-zinc-900 underline underline-offset-2"
              >
                {allFilteredSelected ? "取消全选" : "全选"}
              </button>
              <span className="text-xs text-zinc-500 border-l border-zinc-200 pl-3">
                已选择 <span className="font-semibold text-zinc-800">{selectedIds.size}</span> 条
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-xs text-zinc-500 uppercase tracking-wider">
                  <th className="w-10 px-3 py-2.5 text-center"></th>
                  <th className="text-left px-3 py-2.5">渠道名称</th>
                  <th className="text-left px-3 py-2.5">交易流水号</th>
                  <th className="text-right px-3 py-2.5">金额</th>
                  <th className="text-center px-3 py-2.5">状态</th>
                  <th className="text-center px-3 py-2.5">修改标记</th>
                </tr>
              </thead>
              <tbody>
                {filteredReceipts.map((r) => (
                  <tr
                    key={r.id}
                    className={cn(
                      "border-b border-zinc-50 transition-colors cursor-pointer hover:bg-zinc-50/80",
                      selectedIds.has(r.id) && "bg-sky-50/50 hover:bg-sky-50/70"
                    )}
                    onClick={() => toggleSelect(r.id)}
                  >
                    <td className="px-3 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(r.id)}
                        onChange={() => toggleSelect(r.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-3.5 h-3.5 rounded border-zinc-300 text-zinc-800 focus:ring-zinc-500"
                      />
                    </td>
                    <td className="px-3 py-2.5 font-medium">{r.channelName}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-zinc-600">{r.transactionNo}</td>
                    <td className="px-3 py-2.5 text-right font-mono">¥{formatAmount(r.amount)}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={cn("inline-block text-xs px-1.5 py-0.5 rounded font-medium", STATUS_COLORS[r.status])}>
                        {STATUS_LABELS[r.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {hasModifiedFields(r) && (
                        <AlertTriangle className="w-4 h-4 text-amber-500 inline-block" />
                      )}
                    </td>
                  </tr>
                ))}
                {filteredReceipts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-zinc-400 text-xs">暂无匹配记录</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {selectedIds.size > 0 && (
          <section className="border border-zinc-200 bg-white rounded">
            <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50/60">
              <h2 className="text-sm font-semibold">导出预览</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-xs text-zinc-500 uppercase tracking-wider">
                    <th className="text-left px-3 py-2.5">渠道</th>
                    <th className="text-left px-3 py-2.5">流水号</th>
                    <th className="text-right px-3 py-2.5">金额</th>
                    <th className="text-center px-3 py-2.5">状态</th>
                    <th className="text-left px-3 py-2.5">关键字段</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedReceipts.map((r) => {
                    const modifiedFields = r.transactions.flatMap((tx) =>
                      Object.entries(tx.fields)
                        .filter(([, f]) => f.modified)
                        .map(([name, f]) => ({ name, value: f.value }))
                    )
                    return (
                      <tr key={r.id} className="border-b border-zinc-50">
                        <td className="px-3 py-2.5 font-medium">{r.channelName}</td>
                        <td className="px-3 py-2.5 font-mono text-xs text-zinc-600">{r.transactionNo}</td>
                        <td className="px-3 py-2.5 text-right font-mono">¥{formatAmount(r.amount)}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={cn("inline-block text-xs px-1.5 py-0.5 rounded font-medium", STATUS_COLORS[r.status])}>
                            {STATUS_LABELS[r.status]}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-wrap gap-1.5">
                            {Object.entries(
                              r.transactions[0]?.fields ?? {}
                            ).slice(0, 3).map(([name, f]) => (
                              <span
                                key={name}
                                className={cn(
                                  "inline-flex items-center text-xs px-1.5 py-0.5 rounded",
                                  f.modified ? "bg-amber-50 text-amber-800 ring-1 ring-amber-200" : "bg-zinc-100 text-zinc-600"
                                )}
                              >
                                {name}: {f.value}
                                {f.modified && (
                                  <span className="ml-1 text-[10px] font-semibold text-amber-600">已修正</span>
                                )}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {selectedIds.size > 0 && (
          <section className="border border-zinc-200 bg-white rounded">
            <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50/60 flex items-center justify-between">
              <h2 className="text-sm font-semibold">一致性校验</h2>
              <button
                onClick={handleValidate}
                className="flex items-center gap-1.5 text-xs font-medium bg-zinc-800 text-white px-3 py-1.5 rounded hover:bg-zinc-700 transition-colors"
              >
                <FileCheck className="w-3.5 h-3.5" />
                校验一致性
              </button>
            </div>

            {consistencyResult === null && (
              <div className="px-4 py-8 text-center text-xs text-zinc-400">
                点击"校验一致性"以检查清单与明细数据是否一致
              </div>
            )}

            {consistencyResult !== null && consistencyResult.consistent && (
              <div className="px-4 py-4 flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50/60">
                <CheckCircle2 className="w-4.5 h-4.5" />
                <span className="font-medium">清单与明细数据一致</span>
              </div>
            )}

            {consistencyResult !== null && !consistencyResult.consistent && (
              <div className="px-4 py-4 space-y-3">
                <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50/60 -mx-4 -mt-4 px-4 py-2.5 border-b border-red-100">
                  <AlertTriangle className="w-4.5 h-4.5" />
                  <span className="font-medium">发现 {consistencyResult.differences.length} 处不一致</span>
                </div>
                <div className="space-y-2">
                  {consistencyResult.differences.map((diff, i) => (
                    <div key={i} className="bg-red-50/50 border border-red-100 rounded px-3 py-2 text-xs space-y-1">
                      <div className="flex items-center gap-2 font-medium text-red-800">
                        <span className="font-mono">{diff.receiptTransactionNo}</span>
                        <span className="text-red-400">·</span>
                        <span>{diff.field}</span>
                      </div>
                      <div className="text-zinc-600">
                        字段 {diff.field} 已手动修正，清单显示 <span className="font-mono text-red-700">{diff.checklistValue}</span>，明细显示 <span className="font-mono text-amber-700">{diff.detailValue}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {selectedIds.size > 0 && (
          <div className="flex justify-end">
            <button
              onClick={handleExport}
              disabled={!canExport}
              className={cn(
                "flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded transition-colors",
                canExport
                  ? "bg-zinc-800 text-white hover:bg-zinc-700"
                  : "bg-zinc-200 text-zinc-400 cursor-not-allowed"
              )}
            >
              <Download className="w-4 h-4" />
              导出复核清单
            </button>
          </div>
        )}

        <section className="border border-zinc-200 bg-white rounded">
          <button
            onClick={() => setHistoryOpen(!historyOpen)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-zinc-50/60 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-zinc-400" />
              <span>导出历史</span>
              <span className="text-xs font-normal text-zinc-400">({exportRecords.length})</span>
            </div>
            <span className={cn("text-xs text-zinc-400 transition-transform", historyOpen && "rotate-180")}>
              ▼
            </span>
          </button>

          {historyOpen && (
            <div className="border-t border-zinc-100 overflow-x-auto">
              {exportRecords.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-zinc-400">暂无导出记录</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 text-xs text-zinc-500 uppercase tracking-wider">
                      <th className="text-left px-3 py-2.5">导出时间</th>
                      <th className="text-left px-3 py-2.5">操作人</th>
                      <th className="text-center px-3 py-2.5">记录数</th>
                      <th className="text-left px-3 py-2.5">包含流水号</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...exportRecords]
                      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                      .map((rec) => {
                        const txnNos = rec.receiptIds
                          .map((rid) => receipts.find((r) => r.id === rid)?.transactionNo)
                          .filter(Boolean)
                        return (
                          <tr key={rec.id} className="border-b border-zinc-50">
                            <td className="px-3 py-2.5 font-mono text-xs">{formatDateTime(rec.timestamp)}</td>
                            <td className="px-3 py-2.5">{rec.operator}</td>
                            <td className="px-3 py-2.5 text-center">{rec.receiptCount}</td>
                            <td className="px-3 py-2.5 font-mono text-xs text-zinc-600">
                              {txnNos.join("、")}
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
