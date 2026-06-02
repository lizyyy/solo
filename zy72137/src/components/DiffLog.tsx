import { useStore } from "@/store/useStore";
import { History, X, ChevronUp, ChevronDown, Tag } from "lucide-react";

const OP_LABELS: Record<string, { label: string; color: string }> = {
  import: { label: "导入", color: "text-emerald-400" },
  note_edit: { label: "备注", color: "text-amber-400" },
  status_change: { label: "状态", color: "text-sky-400" },
  merge: { label: "合并", color: "text-violet-400" },
};

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function DiffLog() {
  const diffLog = useStore((s) => s.diffLog);
  const isOpen = useStore((s) => s.diffLogOpen);
  const toggleDiffLog = useStore((s) => s.toggleDiffLog);
  const records = useStore((s) => s.records);

  return (
    <div className="mt-4">
      <button
        className="flex items-center gap-2 px-4 py-2 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        onClick={toggleDiffLog}
      >
        <History className="w-3.5 h-3.5" />
        <span>差异日志</span>
        <span className="text-zinc-600">({diffLog.length})</span>
        {isOpen ? (
          <ChevronDown className="w-3.5 h-3.5" />
        ) : (
          <ChevronUp className="w-3.5 h-3.5" />
        )}
      </button>

      {isOpen && (
        <div className="border border-zinc-700/60 rounded-lg bg-zinc-900/60 max-h-[320px] overflow-y-auto">
          {diffLog.length === 0 ? (
            <div className="px-4 py-6 text-center text-zinc-600 text-xs">
              暂无变更记录
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/60">
              {diffLog.map((entry) => {
                const op = OP_LABELS[entry.operationType] || {
                  label: entry.operationType,
                  color: "text-zinc-400",
                };
                const target = records.find((r) => r.id === entry.targetRecordId);

                return (
                  <div key={entry.id} className="px-4 py-2.5 hover:bg-zinc-800/30 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <Tag className={`w-3 h-3 ${op.color}`} />
                      <span className={`text-[10px] font-semibold ${op.color}`}>
                        {op.label}
                      </span>
                      <span className="text-xs text-zinc-300 flex-1">
                        {entry.description}
                      </span>
                      <span className="text-[10px] text-zinc-600">
                        {formatTimestamp(entry.timestamp)}
                      </span>
                    </div>
                    {(entry.beforeValue || entry.afterValue) && (
                      <div className="ml-5 flex items-center gap-2 text-[10px]">
                        {entry.beforeValue && (
                          <span className="text-red-400/70 line-through">
                            {entry.beforeValue}
                          </span>
                        )}
                        {entry.beforeValue && entry.afterValue && (
                          <span className="text-zinc-600">→</span>
                        )}
                        {entry.afterValue && (
                          <span className="text-emerald-400/80">
                            {entry.afterValue}
                          </span>
                        )}
                      </div>
                    )}
                    {target && (
                      <div className="ml-5 text-[10px] text-zinc-600 mt-0.5">
                        当前状态: {target.trackName} | 备注: {target.userNote || "(空)"}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
