import { Fragment, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ClipboardList,
  ArrowUpRight,
  Info,
  TrendingUp,
  BarChart3,
  MapPin,
  FileSpreadsheet,
  HelpCircle,
} from "lucide-react";
import { useReviewStore } from "@/store/useReviewStore";
import StatusBadge from "@/components/StatusBadge";
import type { Anomaly, AnomalyType } from "@/types";
import { cn } from "@/lib/utils";

type KpiCardProps = {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  value: number;
  total?: number;
  label: string;
  trend?: { label: string; up: boolean };
  danger?: boolean;
};

function KpiCard({
  icon: Icon,
  color,
  value,
  total,
  label,
  trend,
  danger,
}: KpiCardProps) {
  return (
    <div
      className={cn(
        "relative rounded-lg border p-5 shadow-card transition hover:shadow-card-hover",
        danger ? "card-anomaly" : "card",
      )}
    >
      <div className="flex items-start justify-between">
        <div
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-lg",
            color,
          )}
        >
          <Icon className={cn("h-5 w-5 text-white")} />
        </div>
        {trend && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
              trend.up
                ? "bg-emerald-50 text-emerald-700"
                : "bg-rose-50 text-rose-700",
            )}
          >
            {trend.up ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingUp className="h-3 w-3 rotate-180" />
            )}
            {trend.label}
          </span>
        )}
      </div>
      <div className="mt-4">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-[34px] font-bold leading-none text-slate-900 tabular-nums">
            {value}
          </span>
          {typeof total === "number" && total > 0 && (
            <span className="text-sm font-medium text-slate-400">
              / {total}
            </span>
          )}
        </div>
        <div className="mt-2 text-[13px] font-medium text-slate-600">
          {label}
        </div>
        {typeof total === "number" && total > 0 && (
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                danger
                  ? "bg-gradient-to-r from-red-400 to-red-600"
                  : "bg-gradient-to-r from-brand-400 to-brand-700",
              )}
              style={{ width: `${Math.min((value / total) * 100, 100)}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function AnomalyTypeDistribution({
  anomalies,
}: {
  anomalies: Anomaly[];
}) {
  const groups = useMemo(() => {
    const map = new Map<AnomalyType, number>();
    anomalies.forEach((a) => map.set(a.type, (map.get(a.type) || 0) + 1));
    const result: { type: AnomalyType; count: number }[] = [];
    const all: AnomalyType[] = ["碰撞", "变更未同步", "坡度异常", "材料不符"];
    all.forEach((t) => result.push({ type: t, count: map.get(t) || 0 }));
    return result;
  }, [anomalies]);
  const total = anomalies.length || 1;

  const colorMap: Record<AnomalyType, string> = {
    碰撞: "bg-rose-500",
    变更未同步: "bg-amber-500",
    坡度异常: "bg-violet-500",
    材料不符: "bg-sky-500",
  };

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-brand-700" />
        <h3 className="font-display text-[15px] font-semibold text-slate-800">
          异常类型分布
        </h3>
      </div>
      <div className="mt-4 space-y-3">
        {groups.map((g) => (
          <div key={g.type}>
            <div className="mb-1 flex items-center justify-between text-[13px]">
              <span className="font-medium text-slate-700">{g.type}</span>
              <span className="tabular-nums text-slate-500">
                {g.count} 条
                <span className="ml-1 text-slate-400">
                  ({Math.round((g.count / total) * 100)}%)
                </span>
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={cn("h-full rounded-full", colorMap[g.type])}
                style={{
                  width: `${(g.count / total) * 100}%`,
                  opacity: g.count === 0 ? 0.15 : 1,
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-lg border border-dashed border-brand-300 bg-brand-50/60 p-3">
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-700" />
          <div className="text-[12px] leading-relaxed text-brand-900">
            <p className="font-semibold">复核进度提示</p>
            <p className="mt-0.5 text-brand-800/90">
              结构工程师「老叶」已完成材料送审表查看，
              <br />
              当前 3 条异常待人工确认处理。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const {
    materials,
    anomalies,
    drawingPoints,
    setHighlightedPoint,
    setSelectedAnomaly,
  } = useReviewStore();

  const kpis = useMemo(() => {
    const total = materials.length;
    const anomalyTotal = anomalies.length;
    const confirmed = anomalies.filter((a) => a.status !== "待确认").length;
    const pending = anomalies.filter((a) => a.status === "待确认").length;
    return { total, anomalyTotal, confirmed, pending };
  }, [materials, anomalies]);

  const anomalyGroups = useMemo(() => {
    const groups = new Map<AnomalyType, Anomaly[]>();
    anomalies.forEach((a) => {
      const list = groups.get(a.type) || [];
      list.push(a);
      groups.set(a.type, list);
    });
    return Array.from(groups.entries());
  }, [anomalies]);

  const confirmedCount = anomalies.filter((a) => a.status !== "待确认").length;
  const pendingCount = anomalies.filter((a) => a.status === "待确认").length;

  function jumpToDrawing(anomaly: Anomaly) {
    setHighlightedPoint(anomaly.drawingPointId);
    setSelectedAnomaly(anomaly.id);
    navigate("/drawing-review");
  }

  const today = "2026-06-10";

  return (
    <div className="space-y-6 p-6">
      {/* 标题区 */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[26px] font-bold tracking-tight text-slate-900">
            项目经理总览 · 屋面排水图纸复核
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[13px] text-slate-500">
            <span>
              <Clock className="mr-1 inline h-3.5 w-3.5" />
              复核日期：{today}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-brand-200 bg-brand-50 px-2 py-0.5 text-[12px] font-medium text-brand-800">
              <Info className="h-3 w-3" />
              汇总口径 = Σ 各异常类型明细数之和
              <HelpCircle className="h-3 w-3 cursor-help text-brand-500" />
            </span>
          </div>
        </div>
        <div className="flex gap-2 no-print">
          <button
            className="btn"
            onClick={() => navigate("/material-review")}
          >
            <FileSpreadsheet className="h-4 w-4" />
            查看材料送审表
          </button>
          <button
            className="btn btn-primary"
            onClick={() => navigate("/review-log")}
          >
            <LayoutDashboard className="h-4 w-4" />
            查看复盘记录
          </button>
        </div>
      </div>

      {/* KPI 卡片 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={ClipboardList}
          color="bg-gradient-to-br from-brand-600 to-brand-800"
          value={kpis.total}
          label="复核总数（材料送审表条目）"
          trend={{ label: "无变化", up: true }}
        />
        <KpiCard
          icon={AlertTriangle}
          color="bg-gradient-to-br from-red-500 to-red-700"
          value={kpis.anomalyTotal}
          total={kpis.total}
          label="异常总数"
          danger
          trend={{ label: `待处理 ${pendingCount}`, up: false }}
        />
        <KpiCard
          icon={CheckCircle2}
          color="bg-gradient-to-br from-emerald-500 to-emerald-700"
          value={kpis.confirmed}
          total={kpis.anomalyTotal}
          label="已完成人工确认"
          trend={{ label: "稳步推进", up: true }}
        />
        <KpiCard
          icon={Clock}
          color="bg-gradient-to-br from-amber-500 to-amber-700"
          value={kpis.pending}
          total={kpis.anomalyTotal}
          label="待处理异常数"
          trend={{ label: "需关注", up: false }}
        />
      </div>

      {/* 主体：异常明细 + 类型分布 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div className="card overflow-hidden lg:col-span-3">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <h3 className="font-display text-[15px] font-semibold text-slate-800">
                异常明细表（按类型分组）
              </h3>
            </div>
            <div className="flex items-center gap-3 text-[12px] text-slate-500">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                严重异常
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-sky-400" />
                一般异常
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-5 py-2.5 font-medium">异常编号</th>
                  <th className="px-3 py-2.5 font-medium">类型</th>
                  <th className="px-3 py-2.5 font-medium">严重度</th>
                  <th className="px-3 py-2.5 font-medium">所在位置</th>
                  <th className="px-3 py-2.5 font-medium">关联材料</th>
                  <th className="px-3 py-2.5 font-medium">状态</th>
                  <th className="px-3 py-2.5 font-medium">确认人 / 时间</th>
                  <th className="px-5 py-2.5 font-medium text-right no-print">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {anomalyGroups.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-5 py-10 text-center text-slate-400"
                    >
                      暂无异常记录 ✅
                    </td>
                  </tr>
                )}
                {anomalyGroups.map(([type, list]) => (
                  <Fragment key={`group-wrap-${type}`}>
                    <tr
                      key={`group-${type}`}
                      className="bg-brand-50/60 text-brand-900"
                    >
                      <td
                        colSpan={8}
                        className="border-t border-brand-200/70 px-5 py-2 text-[12px] font-semibold"
                      >
                        <AlertTriangle className="mr-1.5 inline h-3.5 w-3.5" />
                        {type}
                        <span className="ml-2 rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-medium text-brand-700 ring-1 ring-brand-200">
                          共 {list.length} 条
                        </span>
                      </td>
                    </tr>
                    {list.map((a) => {
                      const point = drawingPoints.find(
                        (p) => p.id === a.drawingPointId,
                      );
                      const mat = materials.find(
                        (m) => m.id === a.materialItemId,
                      );
                      const isSevere = a.severity === "严重";
                      return (
                        <tr
                          key={a.id}
                          className={cn(
                            "transition hover:bg-slate-50",
                            isSevere && "row-anomaly",
                          )}
                        >
                          <td className="px-5 py-3 font-mono font-medium text-slate-800 tabular-nums">
                            {a.id}
                          </td>
                          <td className="px-3 py-3">
                            <span
                              className={cn(
                                "badge",
                                type === "碰撞"
                                  ? "badge-danger"
                                  : type === "变更未同步"
                                    ? "badge-warn"
                                    : type === "坡度异常"
                                      ? "badge-info"
                                      : "badge-info",
                              )}
                            >
                              {type}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <StatusBadge type="severity" value={a.severity} />
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5 text-brand-500" />
                              <div>
                                <div className="font-medium text-slate-700">
                                  {point?.name || "—"}
                                </div>
                                <div className="text-[11px] text-slate-400">
                                  {point ? `分区：${point.zone}区` : ""}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 font-mono text-slate-700 tabular-nums">
                            <div className="font-medium">{mat?.code || "—"}</div>
                            <div className="text-[11px] text-slate-400">
                              {mat?.name || ""}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <StatusBadge type="anomaly" value={a.status} />
                          </td>
                          <td className="px-3 py-3 text-slate-600">
                            {a.confirmedBy ? (
                              <>
                                <div className="font-medium text-slate-700">
                                  {a.confirmedBy}
                                </div>
                                <div className="text-[11px] text-slate-400">
                                  {a.confirmedAt}
                                </div>
                              </>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-right no-print">
                            <button
                              className="inline-flex items-center gap-1 rounded-md bg-brand-800 px-3 py-1.5 text-[12px] font-medium text-white shadow-sm hover:bg-brand-700 active:translate-y-[1px]"
                              onClick={() => jumpToDrawing(a)}
                            >
                              <ArrowUpRight className="h-3.5 w-3.5" />
                              跳转复核
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}

                {/* 合计行 */}
                {anomalies.length > 0 && (
                  <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-700">
                    <td className="px-5 py-3 text-slate-500">合计</td>
                    <td className="px-3 py-3" colSpan={4}>
                      异常总数 = {anomalies.length} 条（
                      <span className="text-red-600">
                        {anomalies.filter((a) => a.severity === "严重").length}
                        条严重
                      </span>
                      ＋
                      <span className="text-sky-700">
                        {
                          anomalies.filter((a) => a.severity === "一般").length
                        }
                        条一般
                      </span>
                      ）
                    </td>
                    <td className="px-3 py-3">
                      已确认 {confirmedCount} / 待处理 {pendingCount}
                    </td>
                    <td className="px-3 py-3" colSpan={2}>
                      <span className="inline-flex items-center gap-1 text-[12px] font-normal text-slate-500">
                        <Info className="h-3 w-3" />
                        汇总口径 = 上方明细数之和（{anomalies.length}）
                      </span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <AnomalyTypeDistribution anomalies={anomalies} />

          <div className="card p-5">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-brand-700" />
              <h3 className="font-display text-[15px] font-semibold text-slate-800">
                口径对齐说明
              </h3>
            </div>
            <div className="mt-3 space-y-2 text-[12px] leading-relaxed text-slate-600">
              <p>
                1. <span className="font-medium">异常总数</span>
                ＝材料送审表关联的图纸点位异常记录数（按点位，不按行重复计数）
              </p>
              <p>
                2. <span className="font-medium">已确认数</span>
                ＝状态为「已确认正常」与「已确认异常」之和
              </p>
              <p>
                3. <span className="font-medium">异常类型计数</span>
                ＝各分组内明细数之和，与汇总卡片一致
              </p>
              <p>
                4. <span className="font-medium">异常明细</span>
                中每条对应 KPI 异常总数中的一个编号，便于钻取核对
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
