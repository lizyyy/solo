import { useEffect } from "react"
import { useReviewStore } from "@/store/useReviewStore"
import ImportArea from "@/components/ImportArea"
import RecordTable from "@/components/RecordTable"
import { ClipboardCheck, TrendingDown, TrendingUp, Minus } from "lucide-react"

export default function Dashboard() {
  const records = useReviewStore((s) => s.records)
  const loadDemoData = useReviewStore((s) => s.loadDemoData)

  useEffect(() => {
    if (records.length === 0) {
      loadDemoData()
    }
  }, [])

  const normalCount = records.filter((r) => r.status === "normal").length
  const reviewCount = records.filter((r) => r.status === "pending_review").length
  const supplementCount = records.filter((r) => r.status === "pending_supplement")
    .length

  const totalDiff = records.reduce((sum, r) => sum + (r.balanceDiff ?? 0), 0)

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-teal-600 flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-zinc-900">
                柜员长短款复盘
              </h1>
              <p className="text-[11px] text-zinc-400">
                导入 → 补录 → 联动，证据链不断裂
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-zinc-400">
            <span className="px-2 py-1 rounded bg-zinc-100">对账运营：阿芬</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6 space-y-5">
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-[11px] font-medium text-zinc-400 mb-1">总记录</p>
            <p className="text-2xl font-bold text-zinc-900">{records.length}</p>
          </div>
          <div className="rounded-xl border border-teal-200 bg-teal-50 p-4">
            <p className="text-[11px] font-medium text-teal-600 mb-1">正常</p>
            <p className="text-2xl font-bold text-teal-700">{normalCount}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-[11px] font-medium text-amber-600 mb-1">待复核</p>
            <p className="text-2xl font-bold text-amber-700">{reviewCount}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-[11px] font-medium text-zinc-400 mb-1">待补录</p>
            <p className="text-2xl font-bold text-zinc-900">{supplementCount}</p>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <p className="text-[11px] font-medium text-zinc-400 mb-2">
            余额差异汇总
          </p>
          <div className="flex items-end gap-2">
            <p
              className={`text-2xl font-bold font-mono ${
                totalDiff < 0
                  ? "text-red-600"
                  : totalDiff > 0
                  ? "text-green-600"
                  : "text-zinc-900"
              }`}
            >
              {totalDiff >= 0 ? "+" : ""}
              {totalDiff.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-zinc-400 mb-0.5">元</p>
            <div className="ml-auto flex items-center gap-1">
              {totalDiff < 0 ? (
                <TrendingDown className="w-4 h-4 text-red-400" />
              ) : totalDiff > 0 ? (
                <TrendingUp className="w-4 h-4 text-green-400" />
              ) : (
                <Minus className="w-4 h-4 text-zinc-300" />
              )}
              <span className="text-xs text-zinc-400">
                {totalDiff === 0
                  ? "余额无差异"
                  : totalDiff < 0
                  ? "短款"
                  : "长款"}
              </span>
            </div>
          </div>
        </div>

        <ImportArea />
        <RecordTable />
      </main>
    </div>
  )
}
