import { useEffect, useMemo, useState } from "react";
import {
  Plane,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Clock,
  Copy,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useAppStore } from "@/store/useAppStore";
import api from "@/utils/api";
import FilterBar from "@/components/FilterBar";
import StatusBadge from "@/components/StatusBadge";
import ExportButton from "@/components/ExportButton";
import { ReviewData, RuleType, RULE_TYPE_LABELS } from "@/types";

const PIE_COLORS = ["#16A34A", "#E8913A", "#DC2626", "#4A7FB5"];
const PIE_LABELS = ["正常", "警告", "严重", "已更正"];
const statusKeys: Array<"normal" | "warning" | "critical" | "corrected"> = ["normal", "warning", "critical", "corrected"];

const RULE_TYPE_TAG_STYLE: Record<RuleType, string> = {
  no_fly_zone: "bg-red-50 text-red-600",
  data_integrity: "bg-amber-50 text-amber-600",
  anomaly: "bg-amber-50 text-amber-600",
  custom: "bg-slate-100 text-slate-600",
};

export default function FlightReview() {
  const { filters } = useAppStore();
  const [data, setData] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params: Record<string, string | number | boolean | null | undefined> = {};
    if (filters.dateRange) {
      params.startDate = filters.dateRange[0];
      params.endDate = filters.dateRange[1];
    }
    if (filters.status) params.status = filters.status;
    if (filters.severity) params.severity = filters.severity;
    if (filters.towerId) params.towerId = filters.towerId;

    api
      .get<ReviewData>("/review", { params })
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filters]);

  const summary = data?.summary;

  const summaryCards = useMemo(() => {
    if (!summary) return [];
    const totalFlights = summary.totalFlights || 0;
    const normalRate = totalFlights > 0 ? (summary.normalCount / totalFlights * 100) : 0;
    const anomalyRate = totalFlights > 0 ? ((summary.warningCount + summary.criticalCount) / totalFlights * 100) : 0;
    return [
      { label: "总飞行次数", value: totalFlights, icon: Plane, color: "text-steel", bg: "bg-steel/10" },
      { label: "正常率", value: `${normalRate.toFixed(1)}%`, icon: CheckCircle2, color: "text-success", bg: "bg-success/10" },
      { label: "异常率", value: `${anomalyRate.toFixed(1)}%`, icon: AlertTriangle, color: "text-accent", bg: "bg-accent/10" },
      { label: "禁飞区擦边", value: summary.noFlyZoneEdges, icon: ShieldAlert, color: "text-red-600", bg: "bg-red-50" },
      { label: "晚到附件率", value: `${summary.lateAttachmentRate}%`, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
      { label: "重复率", value: `${summary.duplicateRate}%`, icon: Copy, color: "text-slate-600", bg: "bg-slate-100" },
    ];
  }, [summary]);

  const pieData = useMemo(() => {
    if (!summary) return statusKeys.map((_, i) => ({ name: PIE_LABELS[i], value: 0 }));
    const counts = [summary.normalCount, summary.warningCount, summary.criticalCount, summary.correctedCount];
    return statusKeys.map((_, i) => ({ name: PIE_LABELS[i], value: counts[i] }));
  }, [summary]);

  const dailyTrend = useMemo(() => {
    if (!data?.records) return [];
    const grouped: Record<string, { normal: number; warning: number; critical: number; corrected: number }> = {};
    data.records.forEach((r) => {
      const date = r.flightDate.slice(5);
      if (!grouped[date]) grouped[date] = { normal: 0, warning: 0, critical: 0, corrected: 0 };
      grouped[date][r.status]++;
    });
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({ date, ...counts }));
  }, [data?.records]);

  const towerAnomaly = useMemo(() => {
    if (!data?.records) return [];
    const grouped: Record<string, number> = {};
    data.records.forEach((r) => {
      if (r.status !== "normal") {
        grouped[r.towerId] = (grouped[r.towerId] || 0) + 1;
      }
    });
    return Object.entries(grouped)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([towerId, count]) => ({ towerId, count }));
  }, [data?.records]);

  const filteredRecords = useMemo(() => {
    return data?.records ?? [];
  }, [data?.records]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-primary">飞行复盘</h1>
      </div>

      <FilterBar />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {summaryCards.map((card) => (
          <div key={card.label} className="card card-body flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center shrink-0`}>
              <card.icon className={`w-4.5 h-4.5 ${card.color}`} />
            </div>
            <div className="min-w-0">
              <div className="text-lg font-bold text-primary leading-tight">{card.value}</div>
              <div className="text-[11px] text-gray-400 truncate">{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card">
          <div className="card-header">状态分布</div>
          <div className="card-body flex items-center justify-center">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #f0f0f0",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                    fontSize: 12,
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  iconSize={8}
                  formatter={(value: string) => <span className="text-xs text-gray-600">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-2 card">
          <div className="card-header">按日巡检趋势</div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={dailyTrend} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #f0f0f0",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                    fontSize: 12,
                  }}
                />
                <Legend
                  verticalAlign="top"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 12, paddingBottom: 8 }}
                />
                <Bar dataKey="normal" name="正常" stackId="a" fill="#16A34A" radius={[0, 0, 0, 0]} />
                <Bar dataKey="warning" name="警告" stackId="a" fill="#E8913A" />
                <Bar dataKey="critical" name="严重" stackId="a" fill="#DC2626" />
                <Bar dataKey="corrected" name="已更正" stackId="a" fill="#4A7FB5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">杆塔异常排行</div>
        <div className="card-body">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={towerAnomaly} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12 }} stroke="#9ca3af" />
              <YAxis
                type="category"
                dataKey="towerId"
                tick={{ fontSize: 12, fontFamily: "inherit" }}
                stroke="#9ca3af"
                width={60}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #f0f0f0",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                  fontSize: 12,
                }}
                formatter={(value: number) => [value, "异常次数"]}
              />
              <Bar dataKey="count" fill="#E8913A" radius={[0, 4, 4, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="card-header flex items-center justify-between">
          <span>记录明细</span>
          <ExportButton />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                <th className="px-5 py-3 font-medium">杆塔编号</th>
                <th className="px-5 py-3 font-medium">日期</th>
                <th className="px-5 py-3 font-medium">状态</th>
                <th className="px-5 py-3 font-medium">异常类型</th>
                <th className="px-5 py-3 font-medium">判断理由</th>
                <th className="px-5 py-3 font-medium">标记</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-gray-400">
                    加载中…
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-gray-400">
                    暂无数据
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => {
                  const primaryJudgment = record.judgments[0];
                  const ruleTypes = [...new Set(record.judgments.map((j) => j.ruleType))];
                  return (
                    <tr key={record.id} className="hover:bg-gray-50/50">
                      <td className="px-5 py-3 font-medium text-primary font-mono text-xs">
                        {record.towerId}
                      </td>
                      <td className="px-5 py-3 text-gray-500 font-mono text-xs">{record.flightDate}</td>
                      <td className="px-5 py-3">
                        <StatusBadge status={record.status} />
                      </td>
                      <td className="px-5 py-3 text-gray-500">
                        {primaryJudgment ? RULE_TYPE_LABELS[primaryJudgment.ruleType] : "-"}
                      </td>
                      <td className="px-5 py-3 text-gray-500 max-w-xs truncate">
                        {primaryJudgment?.reasoning ?? "-"}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5">
                          {ruleTypes.length > 0 ? ruleTypes.map((rt) => (
                            <span key={rt} className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${RULE_TYPE_TAG_STYLE[rt]}`}>
                              {RULE_TYPE_LABELS[rt]}
                            </span>
                          )) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
