import type { ReactNode } from "react";
import { AlertTriangle, AlertCircle, CheckCircle2, Clock } from "lucide-react";

type Kind = "anomaly" | "pending" | "ok" | "late";

const MAP: Record<Kind, { bg: string; fg: string; icon: ReactNode; label: string }> = {
  anomaly: {
    bg: "bg-alert-red/15 border-alert-red/40",
    fg: "text-alert-red",
    icon: <AlertTriangle className="h-3 w-3" />,
    label: "异常",
  },
  pending: {
    bg: "bg-alert-amber/15 border-alert-amber/40",
    fg: "text-alert-amber",
    icon: <AlertCircle className="h-3 w-3" />,
    label: "待确认",
  },
  ok: {
    bg: "bg-tide-500/15 border-tide-500/40",
    fg: "text-tide-500",
    icon: <CheckCircle2 className="h-3 w-3" />,
    label: "正常",
  },
  late: {
    bg: "bg-violet-400/15 border-violet-400/40",
    fg: "text-violet-300",
    icon: <Clock className="h-3 w-3" />,
    label: "晚到",
  },
};

export function StatusBadge({ kind, text }: { kind: Kind; text?: string }) {
  const m = MAP[kind];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${m.bg} ${m.fg}`}>
      {m.icon}
      {text ?? m.label}
    </span>
  );
}
