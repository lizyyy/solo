import type { ExceptionType } from "@/types";
import { EXCEPTION_EXPLANATIONS, EXCEPTION_LABELS } from "@/types";
import { AlertTriangle, FileWarning, Bug } from "lucide-react";

interface ExceptionPanelProps {
  exceptionType: ExceptionType;
}

function getExceptionIcon(type: ExceptionType) {
  switch (type) {
    case "idempotency_key_collision":
      return <AlertTriangle className="w-5 h-5 text-amber-500" />;
    case "audit_log_gap":
      return <FileWarning className="w-5 h-5 text-amber-500" />;
    case "client_param_corrupted":
      return <Bug className="w-5 h-5 text-amber-500" />;
    default:
      return null;
  }
}

export default function ExceptionPanel({ exceptionType }: ExceptionPanelProps) {
  if (exceptionType === "none") return null;

  const explanation = EXCEPTION_EXPLANATIONS[exceptionType];

  return (
    <div className="border border-amber-300 dark:border-amber-700 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 flex items-center gap-2">
        {getExceptionIcon(exceptionType)}
        <span className="text-sm font-semibold text-amber-800 dark:text-amber-200">
          异常解释：{EXCEPTION_LABELS[exceptionType]}
        </span>
      </div>

      <div className="p-4 space-y-3 bg-white dark:bg-zinc-900">
        <div>
          <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
            原因
          </div>
          <div className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
            {explanation.reason}
          </div>
        </div>

        <div>
          <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
            影响
          </div>
          <div className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
            {explanation.impact}
          </div>
        </div>

        <div>
          <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
            建议处理方式
          </div>
          <div className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
            {explanation.suggestion}
          </div>
        </div>
      </div>
    </div>
  );
}
