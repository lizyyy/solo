import { useStore } from "@/store/useStore"
import { X, ArrowRight, GitBranch } from "lucide-react"

export default function TraceDrawer() {
  const open = useStore((s) => s.traceDrawerOpen)
  const accountId = useStore((s) => s.traceDrawerAccountId)
  const accounts = useStore((s) => s.accounts)
  const closeTraceDrawer = useStore((s) => s.closeTraceDrawer)

  if (!open || !accountId) return null

  const account = accounts.find((a) => a.id === accountId)
  if (!account) return null

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-40 transition-opacity"
        onClick={closeTraceDrawer}
      />
      <div className="fixed right-0 top-0 bottom-0 w-[520px] bg-[#13161f] border-l border-zinc-800/60 z-50 flex flex-col shadow-2xl shadow-black/30 animate-in slide-in-from-right duration-300">
        <div className="px-6 py-5 border-b border-zinc-800/60 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">来源追溯</h3>
            <p className="text-xs text-zinc-500 mt-0.5">{account.accountName} · {account.accountNo}</p>
          </div>
          <button
            onClick={closeTraceDrawer}
            className="w-7 h-7 rounded-lg bg-zinc-800/50 flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-0">
            {account.sourceTrace.map((trace, idx) => (
              <div key={idx} className="relative flex gap-4 pb-6">
                <div className="flex flex-col items-center">
                  <div className="w-7 h-7 rounded-full bg-sky-500/10 border border-sky-500/30 flex items-center justify-center shrink-0 z-10">
                    <span className="text-[10px] font-bold text-sky-400">{trace.step}</span>
                  </div>
                  {idx < account.sourceTrace.length - 1 && (
                    <div className="w-px flex-1 bg-zinc-700/50 mt-1" />
                  )}
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm text-zinc-200 font-medium">{trace.action}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                    <span className="font-mono">{new Date(trace.timestamp).toLocaleString("zh-CN")}</span>
                    <span>·</span>
                    <span>{trace.operator}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <GitBranch className="w-3 h-3 text-sky-500/60" />
                    <span className="text-[11px] font-mono text-sky-400/80 bg-sky-500/5 px-2 py-0.5 rounded">
                      规则版本 {trace.ruleVersion}
                    </span>
                  </div>
                  {idx < account.sourceTrace.length - 1 && (
                    <div className="mt-3 flex items-center gap-1 text-zinc-600">
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-5 border-t border-zinc-800/60">
            <h4 className="text-xs text-zinc-500 mb-3 font-medium">当前账户关键指标</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-zinc-800/30 rounded-lg p-3">
                <div className="text-[10px] text-zinc-500 mb-1">账户余额</div>
                <div className="text-sm font-mono text-zinc-200">{(account.balance / 10000).toFixed(1)}万</div>
              </div>
              <div className="bg-zinc-800/30 rounded-lg p-3">
                <div className="text-[10px] text-zinc-500 mb-1">归集金额</div>
                <div className="text-sm font-mono text-zinc-200">{(account.collectAmount / 10000).toFixed(1)}万</div>
              </div>
              <div className="bg-zinc-800/30 rounded-lg p-3">
                <div className="text-[10px] text-zinc-500 mb-1">留底余额 / 要求</div>
                <div className={`text-sm font-mono ${account.isReserveShortage ? "text-amber-400" : "text-zinc-200"}`}>
                  {(account.reserveBalance / 10000).toFixed(1)} / {(account.reserveRequired / 10000).toFixed(1)}万
                </div>
              </div>
              <div className="bg-zinc-800/30 rounded-lg p-3">
                <div className="text-[10px] text-zinc-500 mb-1">限额余额</div>
                <div className={`text-sm font-mono ${account.isLimitExceeded ? "text-red-400" : "text-zinc-200"}`}>
                  {(account.limitRemain / 10000).toFixed(1)}万
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
