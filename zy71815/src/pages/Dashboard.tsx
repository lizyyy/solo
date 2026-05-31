import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Clock,
  ArrowRightLeft,
  CheckCircle2,
  Currency,
  AlertTriangle,
  Upload,
  FileText,
} from "lucide-react";
import { useSettlementStore } from "@/store/settlementStore";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";

export default function Dashboard() {
  const navigate = useNavigate();
  const { stats, fetchStats, importSessions, fetchImportSessions } =
    useSettlementStore();

  useEffect(() => {
    fetchStats();
    fetchImportSessions();
  }, []);

  const formatAmount = (val: number) =>
    (val ?? 0).toLocaleString("zh-CN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const recentSessions = importSessions.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-5">
        <StatCard
          title="待确认金额"
          value={`¥${formatAmount(stats?.pending_amount ?? 0)}`}
          count={stats?.pending_count ?? 0}
          icon={<Clock className="h-5 w-5" />}
          color="amber"
        />
        <StatCard
          title="跨期手续费"
          value={`¥${formatAmount(stats?.cross_period_fee ?? 0)}`}
          count={stats?.cross_period_count ?? 0}
          icon={<ArrowRightLeft className="h-5 w-5" />}
          color="teal"
        />
        <StatCard
          title="已确认金额"
          value={`¥${formatAmount(stats?.confirmed_amount ?? 0)}`}
          count={stats?.confirmed_count ?? 0}
          icon={<CheckCircle2 className="h-5 w-5" />}
          color="emerald"
        />
        <StatCard
          title="总金额"
          value={`¥${formatAmount(stats?.total_amount ?? 0)}`}
          count={stats?.total_count ?? 0}
          icon={<Currency className="h-5 w-5" />}
          color="slate"
        />
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">最近导入</h2>
            <button
              onClick={() => navigate("/import")}
              className="text-xs text-teal-700 hover:underline"
            >
              查看全部
            </button>
          </div>
          {recentSessions.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              暂无导入记录
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-500">
                  <th className="pb-2 text-left font-medium">文件名</th>
                  <th className="pb-2 text-left font-medium">时间</th>
                  <th className="pb-2 text-right font-medium">新增</th>
                  <th className="pb-2 text-right font-medium">重复</th>
                  <th className="pb-2 text-right font-medium">冲突</th>
                  <th className="pb-2 text-right font-medium">状态</th>
                </tr>
              </thead>
              <tbody>
                {recentSessions.map((session) => (
                  <tr
                    key={session.id}
                    className="border-b border-slate-50 hover:bg-slate-50"
                  >
                    <td className="py-2 text-slate-700">{session.file_name}</td>
                    <td className="py-2 tabular-nums text-slate-500">
                      {new Date(session.created_at).toLocaleString("zh-CN", {
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-2 text-right tabular-nums text-emerald-600">
                      {session.new_count}
                    </td>
                    <td className="py-2 text-right tabular-nums text-amber-600">
                      {session.duplicate_count}
                    </td>
                    <td className="py-2 text-right tabular-nums text-red-600">
                      {session.conflict_count}
                    </td>
                    <td className="py-2 text-right">
                      <StatusBadge status={session.status === "completed" ? "confirmed" : session.status === "failed" ? "conflict" : "pending"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-slate-800">
              待处理提醒
            </h2>
            <div className="space-y-3">
              {(stats?.cross_period_count ?? 0) > 0 && (
                <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                  <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-800">
                      有 {stats?.cross_period_count} 笔跨期手续费待确认
                    </p>
                    <p className="text-xs text-amber-600">
                      手续费归属期与结算期间不一致，请及时处理
                    </p>
                  </div>
                  <button
                    onClick={() => navigate("/settlements")}
                    className="text-xs font-medium text-amber-700 hover:underline"
                  >
                    去处理
                  </button>
                </div>
              )}

              <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800">
                    请关注异常冲突记录
                  </p>
                  <p className="text-xs text-red-600">
                    存在金额不一致的冲突数据，需要人工核实修正
                  </p>
                </div>
                <button
                  onClick={() => navigate("/settlements")}
                  className="text-xs font-medium text-red-700 hover:underline"
                >
                  去查看
                </button>
              </div>

              {(stats?.pending_count ?? 0) === 0 &&
                (stats?.cross_period_count ?? 0) === 0 && (
                  <p className="py-4 text-center text-sm text-slate-400">
                    暂无待处理事项
                  </p>
                )}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => navigate("/import")}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700"
            >
              <Upload className="h-5 w-5" />
              导入结算数据
            </button>
            <button
              onClick={() => navigate("/settlements")}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700"
            >
              <FileText className="h-5 w-5" />
              查看全部明细
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
