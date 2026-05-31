import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useStore } from "@/store";

export default function LeakAlertBanner() {
  const { leakAlerts } = useStore();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  const unresolvedCount = leakAlerts.filter((a) => !a.isResolved).length;

  if (unresolvedCount === 0 || dismissed) return null;

  return (
    <div className="bg-red-500/10 border-b border-red-500/30 px-6 py-2.5 flex items-center gap-3">
      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
      <span className="text-red-400 text-sm font-medium">
        检测到训练集泄漏风险
      </span>
      <span className="text-red-400/80 text-sm font-mono-display">
        {unresolvedCount} 条未处理告警
      </span>
      <button
        onClick={() => navigate("/leak-detection")}
        className="ml-2 text-sm text-red-300 hover:text-red-200 underline underline-offset-2 transition-colors"
      >
        查看详情
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="ml-auto p-1 rounded hover:bg-red-500/20 text-red-400/60 hover:text-red-400 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
