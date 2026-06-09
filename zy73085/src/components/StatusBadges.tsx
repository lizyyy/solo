import { CheckCircle2, PauseCircle, AlertTriangle, AlertCircle, Clock, HelpCircle, XCircle } from "lucide-react";

export const STATUS_STYLES: Record<string, { label: string; cls: string; icon: any }> = {
  pending: { label: "待处理", cls: "bg-ink-100 text-ink-700 border border-ink-200", icon: Clock },
  processing: { label: "复核中", cls: "bg-brand-50 text-brand-700 border border-brand-200", icon: AlertCircle },
  resolved: { label: "已解决", cls: "bg-safe-50 text-safe-700 border border-safe-200", icon: CheckCircle2 },
  suspended: { label: "已挂起", cls: "bg-warn-50 text-warn-700 border border-warn-200", icon: PauseCircle },
  open: { label: "待复核", cls: "bg-danger-50 text-danger-700 border border-danger-200", icon: AlertTriangle },
  released: { label: "已放行", cls: "bg-safe-100 text-safe-800 border border-safe-300", icon: CheckCircle2 },
};

export const SEVERITY_STYLES: Record<string, { label: string; cls: string; dot: string }> = {
  critical: { label: "严重", cls: "bg-danger-600 text-white", dot: "bg-danger-600" },
  warning: { label: "警告", cls: "bg-warn-600 text-white", dot: "bg-warn-600" },
  info: { label: "提示", cls: "bg-brand-600 text-white", dot: "bg-brand-600" },
};

export const IMPORTANCE_STYLES: Record<string, { label: string; cls: string }> = {
  critical: { label: "关键结构", cls: "bg-danger-50 text-danger-700 border border-danger-200" },
  normal: { label: "普通构件", cls: "bg-brand-50 text-brand-700 border border-brand-200" },
  minor: { label: "次要装饰", cls: "bg-ink-50 text-ink-600 border border-ink-200" },
};

export const HOLD_STYLES: Record<string, { label: string; cls: string; icon: any }> = {
  hold: { label: "必须挂起", cls: "bg-danger-600 text-white", icon: PauseCircle },
  release: { label: "可放行", cls: "bg-safe-600 text-white", icon: CheckCircle2 },
  evaluate: { label: "需评估", cls: "bg-warn-600 text-white", icon: HelpCircle },
};

export function StatusBadge({ status, size = "sm" }: { status: string; size?: "sm" | "xs" }) {
  const st = STATUS_STYLES[status] || {
    label: status || "未知",
    cls: "bg-ink-100 text-ink-600 border border-ink-200",
    icon: HelpCircle,
  };
  const Icon = st.icon;
  return (
    <span className={`eng-tag ${st.cls} ${size === "xs" ? "text-[10px] px-1.5 py-0" : ""}`}>
      <Icon size={size === "xs" ? 10 : 12} />
      {st.label}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: string }) {
  const st = SEVERITY_STYLES[severity] || SEVERITY_STYLES.info;
  return (
    <span className={`eng-tag ${st.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
      {st.label}
    </span>
  );
}

export function ImportanceBadge({ importance }: { importance: string }) {
  const st = IMPORTANCE_STYLES[importance] || IMPORTANCE_STYLES.normal;
  return <span className={`eng-tag ${st.cls}`}>{st.label}</span>;
}

export function HoldBadge({ decision }: { decision: string | null }) {
  if (!decision)
    return (
      <span className="eng-tag bg-ink-50 text-ink-500 border border-ink-200">
        <XCircle size={12} />
        未判定
      </span>
    );
  const st = HOLD_STYLES[decision] || HOLD_STYLES.evaluate;
  const Icon = st.icon;
  return (
    <span className={`eng-tag ${st.cls}`}>
      <Icon size={12} />
      {st.label}
    </span>
  );
}
