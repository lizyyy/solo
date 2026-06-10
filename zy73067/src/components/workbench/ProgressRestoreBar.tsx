import { RefreshCw, X } from "lucide-react";

interface ProgressRestoreBarProps {
  visible: boolean;
  onDismiss: () => void;
  timestamp?: string;
}

export default function ProgressRestoreBar({
  visible,
  onDismiss,
  timestamp,
}: ProgressRestoreBarProps) {
  if (!visible) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-40 animate-slide-in-top">
      <div className="bg-industrial-600 text-white rounded-industrial shadow-lg px-5 py-3 flex items-center gap-4 border border-industrial-400">
        <div className="flex items-center gap-2">
          <div className="relative">
            <RefreshCw
              size={16}
              className="text-industrial-200 animate-spin"
              style={{ animationDuration: "3s" }}
              strokeWidth={2}
            />
          </div>
          <div>
            <p className="text-sm font-semibold">
              已恢复上次处理进度和页面摘要
            </p>
            <p className="text-[11px] text-industrial-200">
              包括滚动位置、筛选条件、选中记录和展开状态
              {timestamp && ` · 快照时间：${new Date(timestamp).toLocaleString("zh-CN")}`}
            </p>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="p-1.5 rounded-industrial hover:bg-industrial-500/50 transition-colors"
          aria-label="关闭提示"
        >
          <X size={16} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
