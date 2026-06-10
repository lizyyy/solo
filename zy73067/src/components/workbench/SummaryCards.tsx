import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileX2,
  Thermometer,
} from "lucide-react";
import { useReviewStore } from "@/store/reviewStore";
import type { StatusFilter } from "@/types";

interface SummaryCardsProps {
  activeFilter?: StatusFilter | "temp";
  onActiveChange?: (f: StatusFilter | "temp") => void;
}

const statusLabel: Record<string, string> = {
  pending: "待复核",
  reviewing: "复核中",
  approved: "已通过",
  rejected: "已驳回",
  tempAdjusted: "临时阈值调整",
  total: "全部记录",
};

export default function SummaryCards({ activeFilter, onActiveChange }: SummaryCardsProps) {
  const getSummaryStats = useReviewStore((s) => s.getSummaryStats);
  const stats = getSummaryStats();
  const setFilters = useReviewStore((s) => s.setFilters);
  const resetFilters = useReviewStore((s) => s.resetFilters);

  const cards = [
    {
      key: "pending" as const,
      label: statusLabel.pending,
      value: stats.pending,
      icon: Clock,
      bgClass: "bg-amber-50 border-amber-200 hover:bg-amber-100",
      textClass: "text-amber-700",
      iconClass: "text-amber-500",
      onClick: () => {
        resetFilters();
        setFilters({ status: "pending", showTempAdjustedOnly: false });
        onActiveChange?.("pending");
      },
    },
    {
      key: "approved" as const,
      label: statusLabel.approved,
      value: stats.approved + stats.rejected,
      icon: CheckCircle2,
      bgClass: "bg-success-50 border-success-200 hover:bg-success-100",
      textClass: "text-success-700",
      iconClass: "text-success-500",
      onClick: () => {
        resetFilters();
        setFilters({ status: "all", showTempAdjustedOnly: false });
        onActiveChange?.("all");
      },
    },
    {
      key: "temp" as const,
      label: statusLabel.tempAdjusted,
      value: stats.tempAdjusted,
      icon: Thermometer,
      bgClass: "bg-alert-50 border-alert-200 hover:bg-alert-100",
      textClass: "text-alert-600",
      iconClass: "text-alert-500",
      onClick: () => {
        resetFilters();
        setFilters({ showTempAdjustedOnly: true, status: "all" });
        onActiveChange?.("temp");
      },
    },
    {
      key: "total" as const,
      label: statusLabel.total,
      value: stats.total,
      icon: FileX2,
      bgClass: "bg-industrial-50 border-industrial-200 hover:bg-industrial-100",
      textClass: "text-industrial-700",
      iconClass: "text-industrial-500",
      onClick: () => {
        resetFilters();
        onActiveChange?.("all");
      },
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-4">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        const isActive =
          activeFilter === card.key ||
          (card.key === "total" && !activeFilter);
        const animClass = [
          "animate-stagger-1",
          "animate-stagger-2",
          "animate-stagger-3",
          "animate-stagger-4",
        ][idx];
        return (
          <button
            key={card.key}
            onClick={card.onClick}
            className={`card-surface ${card.bgClass} ${animClass}
              border-2 p-5 text-left cursor-pointer
              transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover
              ${isActive ? "ring-2 ring-industrial-500 ring-offset-2 shadow-card-hover" : ""}`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className={`text-sm font-medium ${card.textClass} mb-2`}>
                  {card.label}
                </p>
                <p className={`text-3xl font-bold ${card.textClass} font-mono`}>
                  {card.value}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  {card.key === "total"
                    ? "当前汇总全部记录"
                    : card.key === "approved"
                    ? "已复核完成"
                    : card.key === "temp"
                    ? "独立标记单独拎出"
                    : "点击查看列表"}
                </p>
              </div>
              <div className={`p-3 rounded-industrial bg-white/60 ${card.iconClass}`}>
                <Icon size={24} strokeWidth={1.5} />
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
