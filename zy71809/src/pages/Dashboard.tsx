import { useState, useEffect, useMemo } from "react"
import { Link } from "react-router-dom"
import { AlertTriangle, Snowflake, ClipboardCheck, Filter } from "lucide-react"
import { useReceiptStore } from "@/store/useReceiptStore"
import { STATUS_LABELS, STATUS_COLORS } from "@/types"
import type { ReceiptStatus } from "@/types"
import { cn } from "@/lib/utils"

function formatAmount(n: number): string {
  return n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

type StatKey = "exception" | "frozen" | "pending" | null

export default function Dashboard() {
  const receipts = useReceiptStore((s) => s.receipts)
  const init = useReceiptStore((s) => s.init)
  const initialized = useReceiptStore((s) => s.initialized)

  useEffect(() => {
    if (!initialized) init()
  }, [initialized, init])

  const [statusFilter, setStatusFilter] = useState<ReceiptStatus | "">("")
  const [channelKeyword, setChannelKeyword] = useState("")
  const [reportDate, setReportDate] = useState("")
  const [activeStat, setActiveStat] = useState<StatKey>(null)

  const exceptionCount = useMemo(
    () => receipts.filter((r) => r.status === "exception").length,
    [receipts]
  )
  const frozenCount = useMemo(
    () => receipts.filter((r) => !r.frozenReleased && r.frozenAmount > 0).length,
    [receipts]
  )
  const pendingCount = useMemo(
    () => receipts.filter((r) => r.status === "pending").length,
    [receipts]
  )

  const filtered = useMemo(() => {
    return receipts.filter((r) => {
      if (activeStat === "exception" && r.status !== "exception") return false
      if (activeStat === "frozen" && (r.frozenReleased || r.frozenAmount <= 0)) return false
      if (activeStat === "pending" && r.status !== "pending") return false
      if (statusFilter && r.status !== statusFilter) return false
      if (channelKeyword && !r.channelName.includes(channelKeyword)) return false
      if (reportDate && r.reportDate !== reportDate) return false
      return true
    })
  }, [receipts, activeStat, statusFilter, channelKeyword, reportDate])

  function handleStatClick(key: StatKey) {
    setActiveStat((prev) => (prev === key ? null : key))
    setStatusFilter("")
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <h1 className="text-lg font-semibold text-zinc-900">返佣回执看板</h1>
          <p className="mt-0.5 text-xs text-zinc-500">风控运营 · 回执状态总览</p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-4 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => handleStatClick("exception")}
            className={cn(
              "rounded-lg border px-4 py-3 text-left transition-colors",
              activeStat === "exception"
                ? "border-amber-400 bg-amber-50 ring-1 ring-amber-400"
                : "border-zinc-200 bg-white hover:border-amber-300"
            )}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-xs font-medium text-zinc-500">异常笔数</span>
            </div>
            <p className={cn(
              "mt-1 text-2xl font-bold tabular-nums",
              activeStat === "exception" ? "text-amber-700" : "text-zinc-900"
            )}>
              {exceptionCount}
            </p>
          </button>

          <button
            onClick={() => handleStatClick("frozen")}
            className={cn(
              "rounded-lg border px-4 py-3 text-left transition-colors",
              activeStat === "frozen"
                ? "border-amber-400 bg-amber-50 ring-1 ring-amber-400"
                : "border-zinc-200 bg-white hover:border-amber-300"
            )}
          >
            <div className="flex items-center gap-2">
              <Snowflake className="h-4 w-4 text-amber-500" />
              <span className="text-xs font-medium text-zinc-500">冻结未释放</span>
            </div>
            <p className={cn(
              "mt-1 text-2xl font-bold tabular-nums",
              activeStat === "frozen" ? "text-amber-700" : "text-zinc-900"
            )}>
              {frozenCount}
            </p>
          </button>

          <button
            onClick={() => handleStatClick("pending")}
            className={cn(
              "rounded-lg border px-4 py-3 text-left transition-colors",
              activeStat === "pending"
                ? "border-amber-400 bg-amber-50 ring-1 ring-amber-400"
                : "border-zinc-200 bg-white hover:border-amber-300"
            )}
          >
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-amber-500" />
              <span className="text-xs font-medium text-zinc-500">待复核笔数</span>
            </div>
            <p className={cn(
              "mt-1 text-2xl font-bold tabular-nums",
              activeStat === "pending" ? "text-amber-700" : "text-zinc-900"
            )}>
              {pendingCount}
            </p>
          </button>
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-2.5">
          <Filter className="h-4 w-4 text-zinc-400" />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as ReceiptStatus | "")
              setActiveStat(null)
            }}
            className="h-7 rounded border border-zinc-300 bg-white px-2 text-xs text-zinc-700 outline-none focus:border-amber-400"
          >
            <option value="">全部状态</option>
            {(Object.keys(STATUS_LABELS) as ReceiptStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="渠道关键词"
            value={channelKeyword}
            onChange={(e) => setChannelKeyword(e.target.value)}
            className="h-7 w-44 rounded border border-zinc-300 bg-white px-2 text-xs text-zinc-700 placeholder:text-zinc-400 outline-none focus:border-amber-400"
          />
          <input
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            className="h-7 rounded border border-zinc-300 bg-white px-2 text-xs text-zinc-700 outline-none focus:border-amber-400"
          />
          {(statusFilter || channelKeyword || reportDate || activeStat) && (
            <button
              onClick={() => {
                setStatusFilter("")
                setChannelKeyword("")
                setReportDate("")
                setActiveStat(null)
              }}
              className="text-xs text-amber-600 hover:text-amber-700"
            >
              清除筛选
            </button>
          )}
          <span className="ml-auto text-xs text-zinc-400">
            共 {filtered.length} 条
          </span>
        </div>

        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-left">
                <th className="px-3 py-2 font-medium text-zinc-500">渠道名称</th>
                <th className="px-3 py-2 font-medium text-zinc-500">交易流水号</th>
                <th className="px-3 py-2 font-medium text-zinc-500 text-right">金额</th>
                <th className="px-3 py-2 font-medium text-zinc-500">状态</th>
                <th className="px-3 py-2 font-medium text-zinc-500 text-right">冻结天数</th>
                <th className="px-3 py-2 font-medium text-zinc-500">备注</th>
                <th className="px-3 py-2 font-medium text-zinc-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-zinc-400">
                    暂无数据
                  </td>
                </tr>
              )}
              {filtered.map((r) => {
                const isFrozen = !r.frozenReleased && r.frozenDays > 1
                return (
                  <tr
                    key={r.id}
                    className={cn(
                      "border-b border-zinc-100 transition-colors hover:bg-zinc-50",
                      isFrozen && "bg-red-50/50 hover:bg-red-50"
                    )}
                  >
                    <td className="px-3 py-2 text-zinc-800">{r.channelName}</td>
                    <td className="px-3 py-2 font-mono text-zinc-600">{r.transactionNo}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-zinc-800">
                      {formatAmount(r.amount)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "inline-block rounded px-1.5 py-0.5 text-[11px] font-medium",
                          STATUS_COLORS[r.status]
                        )}
                      >
                        {STATUS_LABELS[r.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {r.frozenDays === 0 ? (
                        <span className="text-zinc-300">—</span>
                      ) : (
                        <span className={cn("tabular-nums", r.frozenDays > 1 && "text-red-600 font-medium")}>
                          {r.frozenDays}
                        </span>
                      )}
                    </td>
                    <td className="max-w-[160px] truncate px-3 py-2 text-zinc-500">
                      {r.remark || "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        to={`/receipt/${r.id}`}
                        className="text-amber-600 hover:text-amber-700 hover:underline"
                      >
                        查看详情
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
