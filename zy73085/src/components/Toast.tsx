import { useUIGlobalStore } from "@/stores/useUIGlobalStore";
import { CheckCircle, AlertTriangle, XCircle, Info, X } from "lucide-react";

const ICONS = {
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
  info: Info,
};

const CLS = {
  success: "border-safe-300 bg-safe-50 text-safe-800",
  warning: "border-warn-300 bg-warn-50 text-warn-800",
  error: "border-danger-300 bg-danger-50 text-danger-800",
  info: "border-brand-300 bg-brand-50 text-brand-800",
};

const ICON_CLS = {
  success: "text-safe-600",
  warning: "text-warn-600",
  error: "text-danger-600",
  info: "text-brand-600",
};

export default function Toast() {
  const { toast, clearToast } = useUIGlobalStore();
  if (!toast) return null;
  const Icon = ICONS[toast.type];
  return (
    <div className="fixed top-4 right-4 z-[999] animate-in slide-in-from-right">
      <div className={`eng-card px-4 py-3 min-w-[300px] border-l-4 ${CLS[toast.type]}`}>
        <div className="flex items-center gap-3">
          <Icon size={18} className={ICON_CLS[toast.type]} />
          <p className="text-sm font-medium flex-1">{toast.message}</p>
          <button
            onClick={clearToast}
            className="p-1 rounded hover:bg-white/60 transition-colors text-ink-500"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
