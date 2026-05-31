import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  ClipboardCheck,
  AlertTriangle,
  Plane,
  TrendingUp,
  Clock,
  ArrowRight,
  Loader2,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import SeverityTag from "@/components/SeverityTag";
import { api } from "@/utils/api";
import type { DashboardStats, Severity } from "@/types";

const trendData = [
  { date: "05-25", count: 12, defects: 2 },
  { date: "05-26", count: 8, defects: 1 },
  { date: "05-27", count: 15, defects: 4 },
  { date: "05-28", count: 10, defects: 3 },
  { date: "05-29", count: 18, defects: 5 },
  { date: "05-30", count: 14, defects: 2 },
  { date: "05-31", count: 11, defects: 3 },
];

type SeverityTagLevel = "low" | "medium" | "high" | "critical";

const severityToTagLevel = (s: Severity): SeverityTagLevel => {
  if (s === "critical") return "critical";
  if (s === "warning") return "medium";
  return "low";
};

const SEVERITY_ORDER: Record<Severity, number> = {
  info: 0,
  warning: 1,
  critical: 2,
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = () => {
    setLoading(true);
    setError(null);
    api
      .get<DashboardStats>("/dashboard/stats")
      .then((data) => setStats(data))
      .catch((err) => setError(err.message || "获取仪表盘数据失败"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const statCards = stats
    ? [
        {
          label: "今日巡检数",
          value: String(stats.todayInspections),
          icon: ClipboardCheck,
          color: "text-steel",
          bg: "bg-steel/10",
        },
        {
          label: "异常率",
          value: `${stats.anomalyRate}%`,
          icon: AlertTriangle,
          color: "text-accent",
          bg: "bg-accent/10",
        },
        {
          label: "待处理",
          value: String(stats.pendingCount),
          icon: Search,
          color: "text-danger",
          bg: "bg-danger/10",
        },
        {
          label: "禁飞区擦边",
          value: String(stats.noFlyZoneEdges),
          icon: Plane,
          color: "text-amber-600",
          bg: "bg-amber-100",
        },
      ]
    : [];

  const recentAnomalies = stats?.recentAnomalies.slice(0, 5) ?? [];

  const pendingTaskList = (stats?.pendingTasks ?? []).map((record) => {
    const unconfirmed = record.judgments.filter((j) => !j.confirmed);
    const highest = unconfirmed.reduce<Severity | null>((acc, j) => {
      if (!acc || SEVERITY_ORDER[j.severity] > SEVERITY_ORDER[acc]) return j.severity;
      return acc;
    }, null);
    return {
      id: record.id,
      title: `${record.towerId} ${record.towerName}`,
      priority: severityToTagLevel(highest ?? "info") as SeverityTagLevel,
      unconfirmedCount: unconfirmed.length,
    };
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-steel animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertTriangle className="w-8 h-8 text-danger" />
        <p className="text-sm text-gray-500">{error}</p>
        <button
          className="text-sm text-steel hover:underline"
          onClick={fetchStats}
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-primary">仪表盘</h1>
        <span className="text-sm text-gray-400">2026年5月31日 星期日</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="card card-body flex items-center gap-4">
            <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center`}>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">{card.value}</div>
              <div className="text-xs text-gray-400">{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card">
          <div className="card-header flex items-center justify-between">
            <span>近7天巡检趋势</span>
            <TrendingUp className="w-4 h-4 text-steel" />
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="countGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4A7FB5" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#4A7FB5" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="defectGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E8913A" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#E8913A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #f0f0f0",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  name="巡检数"
                  stroke="#4A7FB5"
                  fill="url(#countGrad)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="defects"
                  name="缺陷数"
                  stroke="#E8913A"
                  fill="url(#defectGrad)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card flex flex-col">
          <div className="card-header flex items-center justify-between">
            <span>待处理任务</span>
            <span className="text-xs text-steel cursor-pointer hover:underline">查看全部</span>
          </div>
          <div className="flex-1 overflow-auto divide-y divide-gray-50">
            {pendingTaskList.map((task) => (
              <div
                key={task.id}
                className="px-5 py-3 flex items-start gap-3 hover:bg-gray-50/50 cursor-pointer"
                onClick={() => navigate(`/records/${task.id}`)}
              >
                <SeverityTag level={task.priority} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-primary font-medium truncate">{task.title}</div>
                  <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {task.unconfirmedCount} 条未确认判断
                  </div>
                </div>
              </div>
            ))}
            {pendingTaskList.length === 0 && (
              <div className="px-5 py-6 text-center text-sm text-gray-400">暂无待处理任务</div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header flex items-center justify-between">
          <span>异常告警</span>
          <span className="text-xs text-steel cursor-pointer hover:underline flex items-center gap-1">
            全部记录 <ArrowRight className="w-3 h-3" />
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                <th className="px-5 py-3 font-medium">杆塔</th>
                <th className="px-5 py-3 font-medium">描述</th>
                <th className="px-5 py-3 font-medium">严重程度</th>
                <th className="px-5 py-3 font-medium">判断理由</th>
                <th className="px-5 py-3 font-medium">时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentAnomalies.map((event) => {
                const details = event.details ?? {};
                const towerInfo = (details.towerId as string) || event.description;
                const reasoning = details.reasoning as string | undefined;
                const severity = severityToTagLevel(
                  (details.severity as Severity) ?? "info"
                );
                const time = event.timestamp
                  ? new Date(event.timestamp).toLocaleTimeString("zh-CN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "";
                return (
                  <tr
                    key={event.id}
                    className="hover:bg-gray-50/50 cursor-pointer"
                    onClick={() => navigate(`/records/${event.recordId}`)}
                  >
                    <td className="px-5 py-3 font-medium text-primary font-mono text-xs">
                      {towerInfo}
                    </td>
                    <td className="px-5 py-3 text-primary">{event.description}</td>
                    <td className="px-5 py-3">
                      <SeverityTag level={severity} />
                    </td>
                    <td className="px-5 py-3 text-gray-500 max-w-xs truncate">
                      {reasoning ?? "-"}
                    </td>
                    <td className="px-5 py-3 text-gray-400 font-mono text-xs">{time}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
