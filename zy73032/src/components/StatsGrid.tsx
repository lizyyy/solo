import type { LucideIcon } from "lucide-react";
import {
  Clock,
  CheckCircle2,
  CircleDashed,
  AlertOctagon,
  FileText,
} from "lucide-react";
import type { Stats } from "@/types";

interface StatCardProps {
  label: string;
  value: number | string;
  subLabel?: string;
  icon: LucideIcon;
  tone: "brand" | "success" | "warning" | "danger" | "neutral";
  pulse?: boolean;
  hint?: string;
}

const TONE: Record<StatCardProps["tone"], { bg: string; icon: string; text: string; ring?: string }> = {
  brand: {
    bg: "bg-brand-50",
    icon: "bg-brand-100 text-brand-700",
    text: "text-brand-700",
  },
  success: {
    bg: "bg-success-50",
    icon: "bg-success-100 text-success-700",
    text: "text-success-700",
  },
  warning: {
    bg: "bg-warm-50",
    icon: "bg-brand-100 text-brand-700",
    text: "text-warm-700",
  },
  danger: {
    bg: "bg-danger-50",
    icon: "bg-danger-100 text-danger-700",
    text: "text-danger-700",
    ring: "animate-pulseSoft",
  },
  neutral: {
    bg: "bg-white",
    icon: "bg-warm-100 text-warm-700",
    text: "text-warm-800",
  },
};

function StatCard({
  label,
  value,
  subLabel,
  icon: Icon,
  tone,
  pulse,
  hint,
}: StatCardProps) {
  const t = TONE[tone];
  return (
    <div
      className={`card p-5 ${t.bg} ${pulse ? "animate-pulseSoft" : ""} ${t.ring ?? ""}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-warm-500 mb-1">{label}</div>
          <div className={`font-serif text-3xl font-bold ${t.text}`}>
            {value}
          </div>
          {subLabel && (
            <div className="text-[11px] text-warm-500 mt-1">{subLabel}</div>
          )}
          {hint && (
            <div className="text-[11px] text-warm-500 mt-2 leading-relaxed">
              {hint}
            </div>
          )}
        </div>
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center ${t.icon}`}
        >
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

interface Props {
  stats: Stats;
  conflictSummary: {
    schedulesExcluded: number;
    medicalExcluded: number;
    namesAffected: number;
  };
}

export default function StatsGrid({ stats, conflictSummary }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      <StatCard
        label="已确认课时"
        value={`${stats.totalMinutes}`}
        subLabel="分钟（已从汇总中排除异常）"
        icon={Clock}
        tone="success"
        hint={`${stats.confirmedCount} 条已确认 · ${stats.withdrawnCount} 条已撤回`}
      />
      <StatCard
        label="待确认排程"
        value={stats.pendingCount}
        subLabel="需要人工核对"
        icon={CircleDashed}
        tone="brand"
        hint="点右侧「排程明细」逐条确认或撤回"
      />
      <StatCard
        label="已确认排程"
        value={stats.confirmedCount}
        subLabel="已纳入公示汇总"
        icon={CheckCircle2}
        tone="neutral"
        hint={`占总排程 ${
          stats.totalSchedules
            ? Math.round((stats.confirmedCount / stats.totalSchedules) * 100)
            : 0
        }%`}
      />
      <StatCard
        label="别名冲突待处理"
        value={conflictSummary.namesAffected}
        subLabel={`影响 ${conflictSummary.schedulesExcluded} 条排程`}
        icon={AlertOctagon}
        tone="danger"
        pulse
        hint={`另外涉及 ${conflictSummary.medicalExcluded} 份手写病历，不计入汇总`}
      />
    </div>
  );
}

export { StatCard, type Props as StatsGridProps };
