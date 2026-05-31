import { useEffect } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { useSettlementStore } from "@/store/settlementStore";
import { cn } from "@/lib/utils";

export default function Toast() {
  const { toastMessage, toastType, clearToast } = useSettlementStore();

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(clearToast, 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage, clearToast]);

  if (!toastMessage) return null;

  return (
    <div className="fixed right-6 top-6 z-50 animate-slide-in">
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg px-4 py-3 shadow-lg",
          toastType === "success"
            ? "bg-emerald-600 text-white"
            : "bg-red-600 text-white"
        )}
      >
        {toastType === "success" ? (
          <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
        ) : (
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
        )}
        <span className="text-sm font-medium">{toastMessage}</span>
        <button
          onClick={clearToast}
          className="ml-2 opacity-70 hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
