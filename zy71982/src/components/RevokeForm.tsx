import { useState } from "react";
import { useQueueStore } from "@/store/useQueueStore";
import { RotateCcw, X, Check } from "lucide-react";

interface RevokeFormProps {
  eventId: string;
  onDone: () => void;
}

export default function RevokeForm({ eventId, onDone }: RevokeFormProps) {
  const { revokeEvent, getEventById } = useQueueStore();
  const event = getEventById(eventId);
  const [reason, setReason] = useState("");
  const [operator, setOperator] = useState("admin");
  const [show, setShow] = useState(false);

  if (!event) return null;

  if (
    event.status === "pending" ||
    event.status === "processing"
  ) {
    return null;
  }

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        className="px-3 py-1.5 text-xs font-medium rounded-md border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors flex items-center gap-1.5"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        撤回修正
      </button>
    );
  }

  return (
    <div className="border border-amber-300 dark:border-amber-700 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 text-sm font-medium text-amber-800 dark:text-amber-200">
        撤回修正：将事件从当前状态回退到待处理
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

        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
            撤回原因 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="请填写撤回原因，此信息将记录在审计日志中..."
            className="w-full px-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 resize-none"
          />
        </div>

        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={() => {
              setShow(false);
              setReason("");
            }}
            className="px-3 py-1.5 text-xs font-medium rounded-md border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5" />
            取消
          </button>
          <button
            onClick={() => {
              if (!reason.trim()) return;
              revokeEvent(eventId, reason.trim(), operator);
              setShow(false);
              setReason("");
              onDone();
            }}
            disabled={!reason.trim()}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-amber-500 text-white hover:bg-amber-600 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check className="w-3.5 h-3.5" />
            确认撤回
          </button>
        </div>
      </div>
    </div>
  );
}
