import { useMemo } from "react"
import { useStore } from "@/store/useStore"
import FilterPanel from "@/components/FilterPanel"
import StatusBadge from "@/components/StatusBadge"
import TraceDrawer from "@/components/TraceDrawer"
import type { SortField } from "@/types"
import { ChevronUp, ChevronDown } from "lucide-react"

const COLUMNS: { key: SortField | "checkbox" | "status" | "ruleVersion" | "trace"; label: string; sortable: boolean; align?: "right" }[] = [
  { key: "checkbox", label: "", sortable: false },
  { key: "accountNo", label: "子账户", sortable: true },
  { key: "balance", label: "余额", sortable: true, align: "right" },
  { key: "collectAmount", label: "归集金额", sortable: true, align: "right" },
  { key: "reserveBalance", label: "留底余额/要求", sortable: true, align: "right" },
  { key: "limitUsed", label: "监管限额", sortable: true, align: "right" },
  { key: "limitRemain", label: "限额余额", sortable: true, align: "right" },
  { key: "status", label: "状态", sortable: false },
  { key: "ruleVersion", label: "规则版本", sortable: false },
  { key: "trace", label: "追溯", sortable: false },
]

function fmt(v: number) {
  return (v / 10000).toFixed(1)
}

export default function Details() {
  const rawAccounts = useStore((s) => s.accounts)
  const filter = useStore((s) => s.filter)
  const sf = useStore((s) => s.sortField)
  const sd = useStore((s) => s.sortDirection)
  const accounts = useMemo(() => {
    let result = rawAccounts.filter((acc) => {
      if (filter.dateRange[0] && acc.collectDate < filter.dateRange[0]) return false
      if (filter.dateRange[1] && acc.collectDate > filter.dateRange[1]) return false
      if (filter.banks.length > 0 && !filter.banks.includes(acc.bank)) return false
      if (filter.statuses.length > 0 && !filter.statuses.includes(acc.status)) return false
      if (filter.ruleVersion && acc.ruleVersion !== filter.ruleVersion) return false
      if (filter.searchKeyword) {
        const kw = filter.searchKeyword.toLowerCase()
        if (!acc.accountName.toLowerCase().includes(kw) && !acc.accountNo.toLowerCase().includes(kw)) return false
      }
      return true
    })
    result = result.sort((a, b) => {
      const aVal = a[sf]
      const bVal = b[sf]
      const dir = sd === "asc" ? 1 : -1
      if (typeof aVal === "string" && typeof bVal === "string") return dir * aVal.localeCompare(bVal)
      return dir * ((aVal as number) - (bVal as number))
    })
    return result
  }, [rawAccounts, filter, sf, sd])
  const selectedIds = useStore((s) => s.selectedIds)
  const toggleSelect = useStore((s) => s.toggleSelect)
  const toggleSelectAll = useStore((s) => s.toggleSelectAll)
  const clearSelection = useStore((s) => s.clearSelection)
  const confirmRecords = useStore((s) => s.confirmRecords)
  const returnRecords = useStore((s) => s.returnRecords)
  const openTraceDrawer = useStore((s) => s.openTraceDrawer)
  const sortField = useStore((s) => s.sortField)
  const sortDirection = useStore((s) => s.sortDirection)
  const setSort = useStore((s) => s.setSort)

  const allIds = accounts.map((a) => a.id)
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id))

  const actionableIds = [...selectedIds].filter((id) => {
    const acc = accounts.find((a) => a.id === id)
    return acc && (acc.status === "pending" || acc.status === "returned")
  })

  return (
    <div className="min-h-screen bg-[#0f1219] p-6 pb-24">
      <div className="max-w-[1400px] mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-zinc-100">现金管理归集限额</h1>
          <span className="text-xs text-zinc-500">明细视图</span>
        </div>

        <FilterPanel />

        <div className="bg-[#13161f] border border-zinc-800/60 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800/60">
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      className={`px-4 py-3 text-xs font-medium text-zinc-400 whitespace-nowrap sticky top-0 bg-[#13161f] z-10 ${
                        col.align === "right" ? "text-right" : "text-left"
                      } ${col.sortable ? "cursor-pointer select-none hover:text-zinc-200" : ""}`}
                      onClick={() => col.sortable && setSort(col.key as SortField)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.key === "checkbox" ? (
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={() => toggleSelectAll(allIds)}
                            className="rounded border-zinc-600 bg-zinc-800 text-sky-500 focus:ring-sky-500/30 focus:ring-offset-0 w-3.5 h-3.5"
                          />
                        ) : (
                          col.label
                        )}
                        {col.sortable && sortField === col.key && (
                          sortDirection === "asc" ? (
                            <ChevronUp className="w-3 h-3 text-sky-400" />
                          ) : (
                            <ChevronDown className="w-3 h-3 text-sky-400" />
                          )
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {accounts.map((acc, idx) => (
                  <tr
                    key={acc.id}
                    className={`border-b border-zinc-800/30 hover:bg-zinc-800/30 transition-colors ${
                      idx % 2 === 1 ? "bg-zinc-800/20" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(acc.id)}
                        onChange={() => toggleSelect(acc.id)}
                        className="rounded border-zinc-600 bg-zinc-800 text-sky-500 focus:ring-sky-500/30 focus:ring-offset-0 w-3.5 h-3.5"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-zinc-200 font-medium">{acc.accountName}</div>
                      <div className="text-[11px] text-zinc-500 font-mono">{acc.accountNo}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-zinc-200">{fmt(acc.balance)}</td>
                    <td className="px-4 py-3 text-right font-mono text-zinc-200">{fmt(acc.collectAmount)}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      <span className={acc.isReserveShortage ? "text-amber-400" : "text-zinc-200"}>
                        {fmt(acc.reserveBalance)}/{fmt(acc.reserveRequired)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-zinc-200">{fmt(acc.regLimit)}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      <span className={acc.limitRemain < 0 ? "text-red-400" : "text-zinc-200"}>
                        {fmt(acc.limitRemain)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={acc.status} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-mono text-sky-400/80 bg-sky-500/10 border border-sky-500/20">
                        {acc.ruleVersion}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openTraceDrawer(acc.id)}
                        className="text-xs text-sky-400 hover:text-sky-300 transition-colors"
                      >
                        查看
                      </button>
                    </td>
                  </tr>
                ))}
                {accounts.length === 0 && (
                  <tr>
                    <td colSpan={COLUMNS.length} className="px-4 py-12 text-center text-zinc-500 text-sm">
                      暂无匹配数据
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#13161f]/95 backdrop-blur-md border-t border-zinc-800/60 z-30">
          <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center gap-4">
            <span className="text-sm text-zinc-300">
              已选择 <span className="text-sky-400 font-medium">{selectedIds.size}</span> 项
            </span>
            <button
              onClick={() => clearSelection()}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              取消选择
            </button>
            <div className="flex-1" />
            <button
              onClick={() => actionableIds.length > 0 && confirmRecords(actionableIds)}
              disabled={actionableIds.length === 0}
              className="px-4 py-1.5 rounded-lg text-sm font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              批量确认
            </button>
            <button
              onClick={() => actionableIds.length > 0 && returnRecords(actionableIds)}
              disabled={actionableIds.length === 0}
              className="px-4 py-1.5 rounded-lg text-sm font-medium bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              批量退回
            </button>
          </div>
        </div>
      )}

      <TraceDrawer />
    </div>
  )
}
