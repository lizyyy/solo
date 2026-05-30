import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  Activity,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useAppStore } from "@/stores/appStore";

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="stat-card">
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}
        >
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-sm text-zinc-500">{label}</p>
          <p className="text-xl font-semibold font-mono">{value}</p>
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="stat-card animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-zinc-200" />
        <div className="space-y-2">
          <div className="h-3 w-16 bg-zinc-200 rounded" />
          <div className="h-5 w-24 bg-zinc-200 rounded" />
        </div>
      </div>
    </div>
  );
}

function ChannelHealthChart({
  data,
}: {
  data: { channelName: string; conversion_rate: number; fatigue_score: number; spend_velocity: number }[];
}) {
  const chartData = data.map((d) => ({
    name: d.channelName,
    转化率: d.conversion_rate,
    疲劳度: d.fatigue_score,
    消耗速度: d.spend_velocity,
  }));

  const getBarColor = (key: string, value: number) => {
    if (key === "疲劳度") return value > 0.7 ? "#ef4444" : value > 0.3 ? "#f59e0b" : "#10b981";
    if (key === "转化率") return value > 0.7 ? "#10b981" : value > 0.3 ? "#f59e0b" : "#ef4444";
    return "#0d9488";
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="font-semibold text-zinc-900">渠道健康度</h3>
      </div>
      <div className="card-body">
        {chartData.length === 0 ? (
          <p className="text-sm text-zinc-400 text-center py-8">暂无渠道数据</p>
        ) : (
          <ResponsiveContainer width="100%" height={chartData.length * 40 + 40}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 60 }}>
              <XAxis type="number" domain={[0, 1]} tick={{ fontSize: 12 }} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 12 }}
                width={56}
              />
              <Tooltip />
              <Bar dataKey="转化率" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, idx) => (
                  <Cell key={idx} fill={getBarColor("转化率", entry.转化率)} />
                ))}
              </Bar>
              <Bar dataKey="疲劳度" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, idx) => (
                  <Cell key={idx} fill={getBarColor("疲劳度", entry.疲劳度)} />
                ))}
              </Bar>
              <Bar dataKey="消耗速度" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, idx) => (
                  <Cell key={idx} fill={getBarColor("消耗速度", entry.消耗速度)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function ExceptionAlerts() {
  const dashboard = useAppStore((s) => s.dashboard);
  const navigate = useNavigate();
  const recent = dashboard?.recentExceptions?.filter(
    (e) => e.status === "open" || e.status === "in_progress"
  ) ?? [];

  const severityBadge = (s: string) => {
    if (s === "critical") return "badge-critical";
    if (s === "warning") return "badge-warning";
    return "badge-info";
  };

  const severityLabel = (s: string) => {
    if (s === "critical") return "严重";
    if (s === "warning") return "警告";
    return "提示";
  };

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <h3 className="font-semibold text-zinc-900">异常提醒</h3>
        {recent.length > 0 && (
          <button
            onClick={() => navigate("/exceptions")}
            className="text-sm text-primary-600 hover:text-primary-700"
          >
            查看全部
          </button>
        )}
      </div>
      <div className="card-body">
        {recent.length === 0 ? (
          <p className="text-sm text-zinc-400 text-center py-8">暂无待处理异常 🎉</p>
        ) : (
          <ul className="space-y-3">
            {recent.map((ex) => (
              <li
                key={ex.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-zinc-50 hover:bg-zinc-100 cursor-pointer transition-colors"
                onClick={() => navigate("/exceptions")}
              >
                <AlertTriangle
                  className={`w-4 h-4 mt-0.5 shrink-0 ${
                    ex.severity === "critical"
                      ? "text-red-500"
                      : ex.severity === "warning"
                      ? "text-amber-500"
                      : "text-blue-500"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={severityBadge(ex.severity)}>
                      {severityLabel(ex.severity)}
                    </span>
                    <span className="text-sm text-zinc-600 truncate">
                      {ex.message}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400">{ex.humanReadableTip}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function PendingItems() {
  const dashboard = useAppStore((s) => s.dashboard);

  const items = dashboard?.pendingItems ?? [];

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="font-semibold text-zinc-900">待处理事项</h3>
      </div>
      <div className="card-body">
        {items.length === 0 ? (
          <p className="text-sm text-zinc-400 text-center py-8">暂无待处理事项</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-zinc-50"
              >
                <span className="badge-info">{item.type}</span>
                <span className="text-sm text-zinc-700 flex-1">
                  {item.message}
                </span>
                <span className="text-xs text-zinc-400 font-mono">
                  {item.createdAt}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { dashboard, loading, fetchDashboard, fetchExceptions, fetchChannels } =
    useAppStore();

  useEffect(() => {
    fetchDashboard();
    fetchExceptions();
    fetchChannels();
  }, [fetchDashboard, fetchExceptions, fetchChannels]);

  if (loading && !dashboard) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold">工作台</h2>
        <div className="grid grid-cols-4 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">工作台</h2>

      <div className="grid grid-cols-4 gap-4">
        <StatCard
          icon={DollarSign}
          label="总预算"
          value={dashboard ? `¥${dashboard.totalBudget.toLocaleString()}` : "—"}
          color="bg-primary-600"
        />
        <StatCard
          icon={CheckCircle2}
          label="已分配"
          value={
            dashboard ? `¥${dashboard.allocatedBudget.toLocaleString()}` : "—"
          }
          color="bg-emerald-500"
        />
        <StatCard
          icon={AlertTriangle}
          label="待处理异常"
          value={
            dashboard
              ? String(
                  dashboard.exceptionStats.critical +
                    dashboard.exceptionStats.warning
                )
              : "—"
          }
          color="bg-amber-500"
        />
        <StatCard
          icon={Activity}
          label="活跃渠道"
          value={dashboard ? String(dashboard.channelHealth.length) : "—"}
          color="bg-blue-500"
        />
      </div>

      <ChannelHealthChart data={dashboard?.channelHealth ?? []} />

      <div className="grid grid-cols-2 gap-6">
        <ExceptionAlerts />
        <PendingItems />
      </div>
    </div>
  );
}
