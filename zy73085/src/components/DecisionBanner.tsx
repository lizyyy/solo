import { AlertTriangle, ShieldCheck, Scale, X } from "lucide-react";
import { HoldDecision } from "@/types";

interface DecisionBannerProps {
  decision: HoldDecision;
  reason: string;
  onHold?: () => void;
  onRelease?: () => void;
  onEvaluate?: () => void;
  onDismiss?: () => void;
}

export default function DecisionBanner({
  decision,
  reason,
  onHold,
  onRelease,
  onEvaluate,
  onDismiss,
}: DecisionBannerProps) {
  if (!decision) return null;

  const config = {
    hold: {
      cls: "border-danger-300 bg-gradient-to-r from-danger-50 to-white",
      leftBar: "bg-danger-600",
      title: "建议挂起 · 影响结构安全",
      titleCls: "text-danger-700",
      icon: AlertTriangle,
      iconBg: "bg-danger-600 text-white",
      actionText: "确认挂起",
      actionCls: "eng-btn-danger",
      action: onHold,
    },
    release: {
      cls: "border-safe-300 bg-gradient-to-r from-safe-50 to-white",
      leftBar: "bg-safe-600",
      title: "可放行 · 不影响主结构",
      titleCls: "text-safe-700",
      icon: ShieldCheck,
      iconBg: "bg-safe-600 text-white",
      actionText: "确认放行",
      actionCls: "eng-btn-safe",
      action: onRelease,
    },
    evaluate: {
      cls: "border-warn-300 bg-gradient-to-r from-warn-50 to-white",
      leftBar: "bg-warn-600",
      title: "需评估 · 请项目总工判断",
      titleCls: "text-warn-700",
      icon: Scale,
      iconBg: "bg-warn-600 text-white",
      actionText: "提交评估",
      actionCls: "eng-btn-warn",
      action: onEvaluate,
    },
  }[decision];

  const Icon = config.icon;

  return (
    <div className={`eng-card border-l-4 ${config.leftBar} ${config.cls} overflow-hidden`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-eng ${config.iconBg} flex items-center justify-center shrink-0 shadow-eng`}>
            <Icon size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className={`text-sm font-bold ${config.titleCls}`}>{config.title}</h4>
              {onDismiss && (
                <button
                  onClick={onDismiss}
                  className="ml-auto p-1 rounded hover:bg-white/50 text-ink-400 hover:text-ink-600 transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <p className="text-sm text-ink-700 leading-relaxed">{reason}</p>
            <div className="mt-3 flex items-center gap-2">
              {config.action && (
                <button onClick={config.action} className={config.actionCls}>
                  {config.actionText}
                </button>
              )}
              <button className="eng-btn text-xs">查看材料清单</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
