import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  ShieldCheck,
  User,
  Clock,
} from "lucide-react";
import { useStore } from "@/store";
import { cn } from "@/lib/utils";

export default function LeakDetectionPage() {
  const { leakAlerts, fetchLeakAlerts, resolveLeakAlert } = useStore();
  const [resolving, setResolving] = useState<string | null>(null);

  useEffect(() => {
    fetchLeakAlerts();
  }, []);

  const unresolved = leakAlerts.filter((a) => !a.isResolved);
  const resolved = leakAlerts.filter((a) => a.isResolved);

  async function handleResolve(id: string) {
    const operator = prompt("请输入操作人姓名");
    if (!operator) return;
    setResolving(id);
    try {
      await resolveLeakAlert(id, operator.trim());
    } finally {
      setResolving(null);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="font-mono-display text-2xl font-bold text-zinc-100 mb-6">
        泄漏检测
      </h1>

      {unresolved.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <span className="text-red-400 text-sm font-medium">
            检测到 {unresolved.length} 条未处理的训练集泄漏风险
          </span>
        </div>
      )}

      {leakAlerts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20">
          <ShieldCheck className="w-16 h-16 text-green-500 mb-4" />
          <p className="text-lg text-green-400 font-medium">未检测到训练集泄漏风险</p>
          <p className="text-sm text-zinc-500 mt-1">所有特征口径安全</p>
        </div>
      )}

      <div className="space-y-4">
        {[...unresolved, ...resolved].map((alert) => {
          const isResolved = alert.isResolved;

          return (
            <div
              key={alert.id}
              className={cn(
                "card-dark p-5 border-l-2",
                isResolved
                  ? "border-l-green-500 opacity-60"
                  : "border-l-red-500"
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono-display font-semibold text-zinc-100">
                      {alert.featureName}
                    </span>
                    <span
                      className={cn(
                        "badge",
                        alert.source === "evaluation_table"
                          ? "text-blue-400 bg-blue-500/10"
                          : "text-amber-400 bg-amber-500/10"
                      )}
                    >
                      {alert.source === "evaluation_table"
                        ? "评估表"
                        : "线上反馈"}
                    </span>
                    {isResolved && (
                      <span className="badge text-green-400 bg-green-500/10 gap-0.5">
                        <CheckCircle className="w-3 h-3" />
                        已处理
                      </span>
                    )}
                  </div>

                  <p className="text-zinc-300 text-sm mb-3">
                    {alert.description}
                  </p>

                  <div className="flex items-center gap-4 text-xs text-zinc-500">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {alert.responsiblePerson}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(alert.detectedAt).toLocaleString("zh-CN")}
                    </span>
                  </div>

                  {alert.nextStep && (
                    <div className="mt-2 text-xs">
                      <span className="text-zinc-500">下一步: </span>
                      <span className="text-amber-400">{alert.nextStep}</span>
                    </div>
                  )}
                </div>

                {!isResolved && (
                  <button
                    onClick={() => handleResolve(alert.id)}
                    disabled={resolving === alert.id}
                    className="btn-primary text-sm ml-4 shrink-0"
                  >
                    {resolving === alert.id ? "处理中..." : "标记已处理"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
