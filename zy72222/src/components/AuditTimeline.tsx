import type { AuditEntry } from "@/types"
import {
  FileDown,
  PenLine,
  RefreshCw,
  ShieldCheck,
  ShieldX,
  FileSearch,
} from "lucide-react"
import { cn } from "@/lib/utils"

const actionIcons: Record<string, React.ReactNode> = {
  import: <FileDown className="w-4 h-4 text-teal-600" />,
  supplement: <PenLine className="w-4 h-4 text-blue-600" />,
  correct: <FileSearch className="w-4 h-4 text-orange-600" />,
  rerun: <RefreshCw className="w-4 h-4 text-purple-600" />,
  review: <ShieldCheck className="w-4 h-4 text-green-600" />,
  review_reject: <ShieldX className="w-4 h-4 text-red-600" />,
}

const actionLabels: Record<string, string> = {
  import: "导入",
  supplement: "补录",
  correct: "修正",
  rerun: "重跑",
  review: "复核通过",
  review_reject: "复核驳回",
}

export default function AuditTimeline({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-zinc-400 text-center py-8">暂无操作记录</p>
    )
  }

  return (
    <div className="relative">
      <div className="absolute left-[15px] top-2 bottom-2 w-px bg-zinc-200" />
      <div className="space-y-0">
        {entries.map((entry, i) => (
          <div
            key={entry.id}
            className={cn(
              "relative pl-10 pr-4 py-3 group",
              i < entries.length - 1 && "border-b border-zinc-100"
            )}
          >
            <div className="absolute left-[7px] top-4 w-[17px] h-[17px] rounded-full bg-white border-2 border-zinc-200 flex items-center justify-center group-hover:border-teal-400 transition-colors">
              {actionIcons[entry.action] || (
                <div className="w-2 h-2 rounded-full bg-zinc-300" />
              )}
            </div>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-semibold text-zinc-700">
                    {entry.step}
                  </span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-100 text-zinc-600">
                    {actionLabels[entry.action]}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  {entry.detail}
                </p>
                {(entry.beforeValue !== undefined || entry.afterValue !== undefined) && (
                  <div className="mt-1.5 flex items-center gap-2 text-[11px]">
                    {entry.beforeValue !== undefined && (
                      <span className="text-zinc-400">
                        变更前：{String(entry.beforeValue)}
                      </span>
                    )}
                    {entry.beforeValue !== undefined && entry.afterValue !== undefined && (
                      <span className="text-zinc-300">→</span>
                    )}
                    {entry.afterValue !== undefined && (
                      <span className="text-teal-600 font-medium">
                        变更后：{String(entry.afterValue)}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-[11px] text-zinc-400">{entry.operator}</p>
                <p className="text-[10px] text-zinc-300">{entry.timestamp}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
