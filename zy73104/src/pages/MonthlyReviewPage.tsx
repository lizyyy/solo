import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  LayoutGrid,
  CheckCircle2,
  Clock,
  XCircle,
  PauseCircle,
  AlertTriangle,
  ChevronRight,
  FileText,
  Layers,
} from "lucide-react";
import { useChecklistStore } from "@/store/useChecklistStore";
import type { Checklist, ChecklistStatus } from "shared/types";
import AppHeader from "@/components/AppHeader";
import StatusBadge from "@/components/StatusBadge";
import { cn } from "@/lib/utils";

function hasAnomaly(c: Checklist): boolean {
  const hasWithdrawnNote = c.bimNotes.some((n) => n.isWithdrawn);
  const layerInvalid = !c.isLayerNameValid;
  return hasWithdrawnNote || layerInvalid;
}

export default function MonthlyReviewPage() {
  const { checklists, fetchChecklists, loading } = useChecklistStore();

  useEffect(() => {
    if (checklists.length === 0) {
      fetchChecklists();
    }
  }, [checklists.length, fetchChecklists]);

  const stats = useMemo(() => {
    const total = checklists.length;
    const confirmed = checklists.filter((c) => c.status === "confirmed").length;
    const pending = checklists.filter((c) => c.status === "pending").length;
    const returned = checklists.filter((c) => c.status === "returned").length;
    const suspended = checklists.filter((c) => c.status === "suspended").length;
    const anomalyCount = checklists.filter(hasAnomaly).length;
    const reviewedCount = confirmed + returned;
    return {
      total,
      confirmed,
      pending,
      returned,
      suspended,
      anomalyCount,
      reviewedCount,
    };
  }, [checklists]);

  const monthLabel = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月`;
  }, []);

  const grouped = useMemo(() => {
    const map: Record<ChecklistStatus, Checklist[]> = {
      confirmed: [],
      pending: [],
      returned: [],
      suspended: [],
    };
    checklists.forEach((c) => map[c.status].push(c));
    return map;
  }, [checklists]);

  const progressPct =
    stats.total > 0 ? (stats.reviewedCount / stats.total) * 100 : 0;
  const anomalyPct =
    stats.total > 0 ? (stats.anomalyCount / stats.total) * 100 : 0;

  const statCards = [
    {
      key: "total",
      label: "本月总数",
      value: stats.total,
      icon: LayoutGrid,
      color: "ink",
      bg: "bg-ink-100",
      iconBg: "bg-ink-200 text-ink-700",
    },
    {
      key: "confirmed",
      label: "已确认",
      value: stats.confirmed,
      icon: CheckCircle2,
      color: "green",
      bg: "bg-green-50",
      iconBg: "bg-green-100 text-accent-confirmed",
    },
    {
      key: "pending",
      label: "待补件",
      value: stats.pending,
      icon: Clock,
      color: "blue",
      bg: "bg-blue-50",
      iconBg: "bg-blue-100 text-accent-pending",
    },
    {
      key: "returned",
      label: "退回",
      value: stats.returned,
      icon: XCircle,
      color: "red",
      bg: "bg-red-50",
      iconBg: "bg-red-100 text-accent-returned",
    },
    {
      key: "suspended",
      label: "挂起",
      value: stats.suspended,
      icon: PauseCircle,
      color: "amber",
      bg: "bg-amber-50",
      iconBg: "bg-amber-100 text-accent-suspended",
    },
    {
      key: "anomaly",
      label: "异常数",
      value: stats.anomalyCount,
      icon: AlertTriangle,
      color: "orange",
      bg: "bg-orange-50",
      iconBg: "bg-orange-100 text-orange-700",
    },
  ];

  const columns: {
    key: ChecklistStatus;
    title: string;
    topColor: string;
    countClass: string;
    accentBg: string;
  }[] = [
    {
      key: "confirmed",
      title: "已确认",
      topColor: "border-t-4 border-t-accent-confirmed",
      countClass: "text-green-700",
      accentBg: "bg-green-50",
    },
    {
      key: "pending",
      title: "待补件",
      topColor: "border-t-4 border-t-accent-pending",
      countClass: "text-blue-700",
      accentBg: "bg-blue-50",
    },
    {
      key: "returned",
      title: "退回",
      topColor: "border-t-4 border-t-accent-returned",
      countClass: "text-red-700",
      accentBg: "bg-red-50",
    },
    {
      key: "suspended",
      title: "挂起",
      topColor: "border-t-4 border-t-accent-suspended",
      countClass: "text-amber-700",
      accentBg: "bg-amber-50",
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-ink-50">
        <AppHeader
          breadcrumb={[{ label: "清单列表", to: "/" }, { label: "月底复核" }]}
          showBack
        />
        <div className="max-w-7xl mx-auto px-6 py-12 text-center text-ink-500">
          加载中...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-50">
      <AppHeader
        breadcrumb={[{ label: "清单列表", to: "/" }, { label: "月底复核" }]}
        showBack
      />

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <div className="card p-5 flex items-center justify-between">
          <div>
            <h1 className="font-serif text-xl font-bold text-ink-900">
              月底复核面板
            </h1>
            <p className="text-sm text-ink-500 mt-1">{monthLabel} 复核周期</p>
          </div>
          <Link to="/" className="btn-ghost">
            <FileText className="w-4 h-4" />
            查看全部清单
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-6 gap-4">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.key}
                className={cn("card p-4", card.bg, "border-ink-200")}
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="text-xs font-medium text-ink-600">
                    {card.label}
                  </span>
                  <div
                    className={cn(
                      "w-8 h-8 rounded-sm2 flex items-center justify-center",
                      card.iconBg
                    )}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                </div>
                <div className="font-serif text-3xl font-bold text-ink-900">
                  {card.value}
                </div>
              </div>
            );
          })}
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-base font-semibold text-ink-800">
              复核进度
            </h2>
            <div className="flex items-center gap-4 text-xs text-ink-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm2 bg-green-500 inline-block" />
                已复核 {stats.reviewedCount}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm2 bg-ink-200 inline-block" />
                待处理 {stats.total - stats.reviewedCount}
              </span>
              <span className="inline-flex items-center gap-1.5 text-orange-600 font-medium">
                <AlertTriangle className="w-3 h-3" />
                异常 {stats.anomalyCount}
              </span>
            </div>
          </div>

          <div className="relative">
            <div className="h-6 bg-ink-100 rounded-sm2 overflow-hidden relative">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-500 flex items-center justify-end pr-2"
                style={{ width: `${progressPct}%` }}
              >
                {progressPct > 12 && (
                  <span className="text-[10px] font-medium text-white">
                    {progressPct.toFixed(0)}%
                  </span>
                )}
              </div>
            </div>

            {stats.anomalyCount > 0 && (
              <div
                className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
                style={{
                  left: `${Math.min(97, Math.max(2, anomalyPct))}%`,
                }}
              >
                <div className="relative">
                  <div className="w-5 h-5 rounded-full bg-orange-500 border-2 border-white shadow-lg flex items-center justify-center animate-pulse">
                    <AlertTriangle className="w-3 h-3 text-white" />
                  </div>
                  <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 bg-orange-600 text-white text-[10px] font-medium px-2 py-0.5 rounded-sm2 whitespace-nowrap">
                    异常 {stats.anomalyCount}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mt-3 text-xs text-ink-400">
            <span>0</span>
            <span>
              已复核 {stats.reviewedCount} / {stats.total}
            </span>
            <span>{stats.total}</span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {columns.map((col) => {
            const items = grouped[col.key];
            return (
              <div
                key={col.key}
                className={cn("card overflow-hidden", col.topColor)}
              >
                <div className={cn("px-4 py-3 border-b border-ink-200", col.accentBg)}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-ink-700">
                      {col.title}
                    </span>
                    <span
                      className={cn(
                        "font-serif text-2xl font-bold",
                        col.countClass
                      )}
                    >
                      {items.length}
                    </span>
                  </div>
                </div>

                <div className="p-2 max-h-[520px] overflow-y-auto space-y-2">
                  {items.length === 0 && (
                    <div className="text-center text-xs text-ink-400 py-8">
                      暂无
                    </div>
                  )}

                  {items.map((item) => {
                    const anomaly = hasAnomaly(item);
                    return (
                      <Link
                        key={item.id}
                        to={`/checklist/${item.id}`}
                        className={cn(
                          "block p-3 rounded-sm2 border border-ink-100 hover:border-brand-300 hover:shadow-card transition-all bg-white group",
                          anomaly && "border-red-200 bg-red-50/50"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="font-mono text-[10px] text-ink-500">
                                {item.code}
                              </span>
                              {anomaly && (
                                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white shrink-0">
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                </span>
                              )}
                            </div>
                            <h3 className="text-sm font-semibold text-ink-800 truncate group-hover:text-brand-700">
                              {item.projectName}
                            </h3>
                          </div>
                          <ChevronRight className="w-4 h-4 text-ink-300 group-hover:text-brand-500 shrink-0 mt-1" />
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          <StatusBadge status={item.status} className="text-[10px] px-1.5 py-0" />
                          <div className="inline-flex items-center gap-1 text-[10px] text-ink-500">
                            <Layers className="w-3 h-3" />
                            <span
                              className={cn(
                                "font-mono truncate max-w-[90px]",
                                !item.isLayerNameValid &&
                                  "text-accent-returned font-medium"
                              )}
                            >
                              {item.layerName || "—"}
                            </span>
                          </div>
                        </div>

                        {anomaly && (
                          <div className="mt-2 pt-2 border-t border-red-100 text-[10px] text-red-600 flex items-center gap-1.5">
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            <span>
                              {!item.isLayerNameValid && "图层命名异常"}
                              {!item.isLayerNameValid &&
                                item.bimNotes.some((n) => n.isWithdrawn) &&
                                " · "}
                              {item.bimNotes.some((n) => n.isWithdrawn) &&
                                "含撤回备注"}
                            </span>
                          </div>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
