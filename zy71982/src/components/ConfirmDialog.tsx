import { useState } from "react";
import { useQueueStore } from "@/store/useQueueStore";
import type { EventStatus } from "@/types";
import { PENDING_CONFIRM_STATUSES, TERMINAL_STATUSES } from "@/types";
import StatusTag from "@/components/StatusTag";
import { CheckCircle2, XCircle } from "lucide-react";

interface ConfirmDialogProps {
  eventId: string;
  currentStatus: EventStatus;
  onDone: () => void;
}

export default function ConfirmDialog({
  eventId,
  currentStatus,
  onDone,
}: ConfirmDialogProps) {
  const { confirmEvent } = useQueueStore();
  const [operator, setOperator] = useState("admin");
  const [show, setShow] = useState(false);

  const canConfirm =
    PENDING_CONFIRM_STATUSES.includes(currentStatus) ||
    TERMINAL_STATUSES.includes(currentStatus);

  if (!canConfirm) return null;

  if (!show) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShow(true)}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/60 transition-colors flex items-center gap-1.5"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          确认
        </button>
      </div>
    );
  }

  return (
    <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 flex items-center gap-2">
        <StatusTag status={currentStatus} compact />
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          → 确认最终结果
        </span>
      </div>

      <div className="p-4 space-y-3 bg-white dark:bg-zinc-900">
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
            操作人
          </label>
          <input
            type="text"
            value={operator}
            onChange={(e) => setOperator(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={() => setShow(false)}
            className="px-3 py-1.5 text-xs font-medium rounded-md border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => {
              confirmEvent(eventId, "success", operator);
              setShow(false);
              onDone();
            }}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-500 text-white hover:bg-emerald-600 transition-colors flex items-center gap-1"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            确认成功
          </button>
          <button
            onClick={() => {
              confirmEvent(eventId, "failed", operator);
              setShow(false);
              onDone();
            }}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors flex items-center gap-1"
          >
            <XCircle className="w-3.5 h-3.5" />
            确认失败
          </button>
        </div>
      </div>
    </div>
  );
}
