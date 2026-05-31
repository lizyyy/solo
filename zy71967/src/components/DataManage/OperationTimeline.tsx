import { useAppStore } from "@/store/useAppStore"
import { ACTION_LABELS, type OperationLog } from "@/types"
import { cn } from "@/lib/utils"

const ACTION_COLORS: Record<OperationLog["action"], string> = {
  import: "bg-blue-400/20 text-blue-400",
  rollback: "bg-red-400/20 text-red-400",
  modify: "bg-amber-400/20 text-amber-400",
  confirm: "bg-emerald-400/20 text-emerald-400",
  reject: "bg-slate-400/20 text-slate-400",
}

const DOT_COLORS: Record<OperationLog["action"], string> = {
  import: "bg-blue-400",
  rollback: "bg-red-400",
  modify: "bg-amber-400",
  confirm: "bg-emerald-400",
  reject: "bg-slate-400",
}

interface OperationTimelineProps {
  experimentId: string | null
}

export default function OperationTimeline({ experimentId }: OperationTimelineProps) {
  const getExperimentOperationLogs = useAppStore((s) => s.getExperimentOperationLogs)
  const logs = experimentId ? getExperimentOperationLogs(experimentId) : []

  if (!experimentId) {
    return (
      <div className="rounded-md bg-slate-900 p-6 text-center text-sm text-slate-500">
        请先选择实验以查看操作日志
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className="rounded-md bg-slate-900 p-6 text-center text-sm text-slate-500">
        暂无操作日志
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {logs.map((log, i) => (
        <div key={log.id} className="flex gap-4">
          <div className="relative flex flex-col items-center">
            <div
              className={cn(
                "z-10 h-2.5 w-2.5 rounded-full",
                DOT_COLORS[log.action]
              )}
            />
            {i < logs.length - 1 && (
              <div className="absolute top-2.5 h-full w-px bg-slate-700" />
            )}
          </div>
          <div className={cn("pb-6", i === logs.length - 1 && "pb-0")}>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-block rounded px-1.5 py-0.5 text-[10px] font-medium",
                  ACTION_COLORS[log.action]
                )}
              >
                {ACTION_LABELS[log.action]}
              </span>
              <span className="text-xs text-slate-500">{log.operator}</span>
              <span className="text-xs text-slate-600">{log.timestamp}</span>
            </div>
            <p className="mt-1 text-sm text-slate-300">{log.detail}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
