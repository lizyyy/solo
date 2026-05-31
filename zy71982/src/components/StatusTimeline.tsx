import { useQueueStore } from "@/store/useQueueStore";
import { getStatusLabel } from "@/utils/statusHelpers";
import { formatTimestamp } from "@/utils/statusHelpers";
import type { EventStatus } from "@/types";
import {
  Circle,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  AlertOctagon,
  RotateCcw,
  Clock,
  Loader2,
} from "lucide-react";

function getStatusIcon(status: EventStatus) {
  const cls = "w-5 h-5";
  switch (status) {
    case "pending":
      return <Clock className={`${cls} text-zinc-400`} />;
    case "processing":
      return <Loader2 className={`${cls} text-amber-500 animate-spin`} />;
    case "success":
      return <CheckCircle2 className={`${cls} text-emerald-500`} />;
    case "failed":
      return <XCircle className={`${cls} text-red-500`} />;
    case "pending_confirm_idempotency":
      return <AlertTriangle className={`${cls} text-amber-500`} />;
    case "pending_confirm_audit_gap":
      return <AlertOctagon className={`${cls} text-amber-500`} />;
    case "pending_confirm_param_corrupted":
      return <AlertTriangle className={`${cls} text-amber-500`} />;
    case "revoked":
      return <RotateCcw className={`${cls} text-slate-400`} />;
    default:
      return <Circle className={`${cls} text-zinc-400`} />;
  }
}

interface StatusTimelineProps {
  eventId: string;
}

export default function StatusTimeline({ eventId }: StatusTimelineProps) {
  const { getStatusChanges } = useQueueStore();
  const changes = getStatusChanges(eventId);

  if (changes.length === 0) {
    return (
      <div className="text-sm text-zinc-400 dark:text-zinc-500 py-4 text-center">
        暂无状态变更记录
      </div>
    );
  }

  return (
    <div className="relative">
      {changes.map((change, idx) => {
        const isLast = idx === changes.length - 1;
        const isGap = change.reason.includes("缺口");

        return (
          <div key={change.id} className="flex gap-4 pb-6 last:pb-0">
            <div className="flex flex-col items-center">
              <div
                className={`relative z-10 ${isGap ? "ring-2 ring-amber-400 rounded-full" : ""}`}
              >
                {getStatusIcon(change.toStatus)}
              </div>
              {!isLast && (
                <div className="w-px flex-1 bg-zinc-200 dark:bg-zinc-700 mt-1" />
              )}
            </div>

            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  {getStatusLabel(change.toStatus)}
                </span>
                {change.fromStatus && (
                  <>
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">
                      ←
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {getStatusLabel(change.fromStatus)}
                    </span>
                  </>
                )}
              </div>

              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 space-y-0.5">
                <div>{change.reason}</div>
                <div className="flex items-center gap-3">
                  <span>{formatTimestamp(change.timestamp)}</span>
                  <span className="text-zinc-400 dark:text-zinc-500">
                    操作人: {change.operator}
                  </span>
                </div>
              </div>

              {isGap && (
                <div className="mt-2 px-3 py-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-300">
                  ⚠ 此处存在审计日志缺口，状态变更过程不可追溯
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
