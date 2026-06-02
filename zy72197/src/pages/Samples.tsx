import { useState } from "react"
import { useStore } from "@/store/useStore"
import StatusBadge from "@/components/StatusBadge"
import { cn } from "@/lib/utils"
import { AlertTriangle, Copy, FileWarning, Filter, Search, ExternalLink, Clock, Tag } from "lucide-react"
import type { SampleSource } from "@/types"

export default function Samples() {
  const samples = useStore((s) => s.samples)
  const [filterSource, setFilterSource] = useState<SampleSource | "all">("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [searchText, setSearchText] = useState("")

  const filtered = samples.filter((s) => {
    if (filterSource !== "all" && s.source !== filterSource) return false
    if (filterStatus !== "all" && s.status !== filterStatus) return false
    if (searchText) {
      const q = searchText.toLowerCase()
      return (
        s.id.toLowerCase().includes(q) ||
        s.content.toLowerCase().includes(q) ||
        s.sourceId.toLowerCase().includes(q) ||
        s.originalLabel.toLowerCase().includes(q)
      )
    }
    return true
  })

  const duplicateCount = samples.filter((s) => s.isDuplicate).length
  const conflictCount = samples.filter((s) => s.hasConflict).length
  const leakageCount = samples.filter((s) => s.hasLeakage).length

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-zinc-100">样本管理</h2>
        <p className="mt-1 text-sm text-zinc-500">管理线上反馈工单导入的安全回放样本，自动检测重复、冲突与泄漏</p>
      </div>

      <div className="mb-5 flex gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-zinc-700/50 bg-zinc-800/50 px-3 py-2">
          <Copy className="h-3.5 w-3.5 text-zinc-500" />
          <span className="text-xs text-zinc-400">重复</span>
          <span className="font-mono text-xs font-semibold text-zinc-200">{duplicateCount}</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
          <span className="text-xs text-rose-300">冲突</span>
          <span className="font-mono text-xs font-semibold text-rose-300">{conflictCount}</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          <FileWarning className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-xs text-amber-300">泄漏</span>
          <span className="font-mono text-xs font-semibold text-amber-300">{leakageCount}</span>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="搜索样本ID、内容、来源编号..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full rounded-lg border border-zinc-700/50 bg-zinc-800/50 py-2 pl-9 pr-4 text-sm text-zinc-200 placeholder-zinc-500 outline-none transition-colors focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-zinc-500" />
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value as SampleSource | "all")}
            className="rounded-lg border border-zinc-700/50 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-300 outline-none focus:border-amber-500/50"
          >
            <option value="all">全部来源</option>
            <option value="线上反馈工单">线上反馈工单</option>
            <option value="历史补录">历史补录</option>
            <option value="主动采集">主动采集</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-zinc-700/50 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-300 outline-none focus:border-amber-500/50"
          >
            <option value="all">全部状态</option>
            <option value="needs_review">待复核</option>
            <option value="model_judged">模型判断</option>
            <option value="human_corrected">人工修正</option>
            <option value="duplicate">重复样本</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-800">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/80">
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">样本ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">来源</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">内容</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">原始标签</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">状态</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">标记</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">导入时间</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((sample) => (
              <tr
                key={sample.id}
                className={cn(
                  "border-b border-zinc-800/60 transition-colors hover:bg-zinc-800/30",
                  sample.hasConflict && "border-l-2 border-l-rose-500",
                  sample.hasLeakage && "border-l-2 border-l-amber-500",
                  sample.isDuplicate && !sample.hasConflict && "bg-zinc-800/20"
                )}
              >
                <td className="px-4 py-3">
                  <span className="font-mono text-xs text-amber-400/80">{sample.id}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <ExternalLink className="h-3 w-3 text-zinc-500" />
                    <div>
                      <p className="text-xs text-zinc-300">{sample.source}</p>
                      <p className="font-mono text-[10px] text-zinc-500">{sample.sourceId}</p>
                    </div>
                  </div>
                </td>
                <td className="max-w-xs px-4 py-3">
                  <p className="truncate text-xs text-zinc-300">{sample.content}</p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <Tag className="h-3 w-3 text-zinc-500" />
                    <span className="text-xs text-zinc-300">{sample.originalLabel}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={sample.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    {sample.isDuplicate && (
                      <span className="inline-flex items-center gap-1 rounded bg-zinc-600/20 px-1.5 py-0.5 text-[10px] text-zinc-400">
                        <Copy className="h-2.5 w-2.5" />
                        重复
                      </span>
                    )}
                    {sample.hasConflict && (
                      <span className="inline-flex items-center gap-1 rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] text-rose-400">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        冲突
                      </span>
                    )}
                    {sample.hasLeakage && (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-400">
                        <FileWarning className="h-2.5 w-2.5" />
                        泄漏
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 text-zinc-500">
                    <Clock className="h-3 w-3" />
                    <span className="font-mono text-[10px]">
                      {new Date(sample.importedAt).toLocaleString("zh-CN")}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="py-12 text-center text-sm text-zinc-500">没有匹配的样本</div>
      )}

      <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-800/30 px-4 py-3">
        <p className="text-xs text-zinc-500">
          共 <span className="font-mono text-zinc-300">{samples.length}</span> 条样本，
          筛选后 <span className="font-mono text-zinc-300">{filtered.length}</span> 条。
          重复样本 <span className="font-mono text-zinc-300">{duplicateCount}</span> 条，
          标签冲突 <span className="font-mono text-rose-400">{conflictCount}</span> 条，
          样本泄漏 <span className="font-mono text-amber-400">{leakageCount}</span> 条。
        </p>
      </div>
    </div>
  )
}
