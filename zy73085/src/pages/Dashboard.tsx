import { Link } from "react-router-dom";
import { useAnomaliesStore } from "@/stores/useAnomaliesStore";
import { useMinutesStore } from "@/stores/useMinutesStore";
import { useMaterialsStore } from "@/stores/useMaterialsStore";
import {
  AlertTriangle,
  Package,
  Download,
  TrendingUp,
  CheckCircle2,
  Clock,
  PauseCircle,
  FileText,
  RefreshCw,
  ArrowRight,
  FileWarning,
  Ban,
  PlayCircle,
  type LucideIcon,
} from "lucide-react";
import { useUIGlobalStore } from "@/stores/useUIGlobalStore";
import { useMemo } from "react";

export default function Dashboard() {
  const { anomalies, reruns, runRecheck } = useAnomaliesStore();
  const { minutes } = useMinutesStore();
  const { batches } = useMaterialsStore();
  const { showToast } = useUIGlobalStore();

  const stats = useMemo(() => {
    const open = anomalies.filter((a) => ["open", "processing"].includes(a.status)).length;
    const resolved = anomalies.filter((a) => a.status === "resolved" || a.status === "released").length;
    const critical = anomalies.filter((a) => a.severity === "critical").length;
    const suspended = anomalies.filter((a) => a.status === "suspended").length;
    const missingMats = batches.filter((b) => b.isMissing).length;
    const pendingMin = minutes.filter((m) => m.status === "pending").length;
    return { open, resolved, critical, suspended, missingMats, pendingMin };
  }, [anomalies, batches, minutes]);

  const recentReruns = reruns.slice(0, 3);

  const trend = useMemo(() => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStr = `${d.getMonth() + 1}/${d.getDate()}`;
      const created = anomalies.filter((a) => {
        const ad = new Date(a.createdAt);
        return ad.toDateString() === d.toDateString();
      }).length;
      const closed = anomalies.filter((a) => {
        const ad = new Date(a.updatedAt);
        return ad.toDateString() === d.toDateString() && ["resolved", "released"].includes(a.status);
      }).length;
      data.push({ day: dayStr, created, closed });
    }
    return data;
  }, [anomalies]);

  const maxVal = Math.max(1, ...trend.map((t) => Math.max(t.created, t.closed)));

  const handleRerun = () => {
    const tracker = runRecheck("算法值班-当前用户");
    showToast(
      "success",
      `重新复核完成 · ${tracker.runId} · 保留 ${tracker.preservedNoteIds.length} 条历史备注`
    );
  };

  return (
    <div className="space-y-6">
      {/* Hero: 三大固定入口 + 重跑按钮 —— 零交接设计 */}
      <section className="eng-card p-6 border-l-4 border-l-brand-600">
        <div className="flex items-start justify-between gap-6 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-black text-ink-900 tracking-tight">
                结构加固图纸复核工作台
              </h1>
              <span className="eng-tag bg-brand-600 text-white font-mono">STR-GRID v1.0</span>
            </div>
            <p className="text-sm text-ink-600 leading-relaxed max-w-2xl">
              施工经理阿乔的现场变更同步到模型；算法值班人一键重跑、追溯结论变化、导出复核包。
              顶部右侧三个入口位置固定，新人接手零交接。
            </p>
          </div>
          <button onClick={handleRerun} className="eng-btn-primary gap-2">
            <RefreshCw size={16} className={recentReruns.length ? "animate-spin" : ""} />
            重新复核 · 保留历史
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link to="/materials" className="eng-card p-5 hover:border-brand-400 transition-all group">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-eng bg-brand-600 text-white flex items-center justify-center shadow-eng group-hover:scale-105 transition-transform">
                <Package size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="eng-section-title text-brand-700 mb-1">
                  材料录入区
                  <span className="font-mono text-[10px] text-brand-500 font-normal">MATERIALS</span>
                </div>
                <div className="text-xs text-ink-500 mb-2">批次登记 · 缺失判定 · 挂起放行</div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="eng-tag bg-danger-50 text-danger-700 border border-danger-200">
                    <AlertTriangle size={10} />
                    {stats.missingMats} 批次缺失
                  </span>
                  <span className="text-ink-400">→</span>
                </div>
              </div>
              <ArrowRight size={18} className="text-ink-300 group-hover:text-brand-600 group-hover:translate-x-1 transition-all" />
            </div>
          </Link>

          <Link to="/anomalies" className="eng-card p-5 hover:border-warn-400 transition-all group">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-eng bg-warn-600 text-white flex items-center justify-center shadow-eng group-hover:scale-105 transition-transform">
                <FileWarning size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="eng-section-title text-warn-700 mb-1">
                  异常查看区
                  <span className="font-mono text-[10px] text-warn-500 font-normal">ANOMALIES</span>
                </div>
                <div className="text-xs text-ink-500 mb-2">追溯时间线 · 结论变化 · 备注留存</div>
                <div className="flex items-center gap-2 text-sm flex-wrap">
                  <span className="eng-tag bg-danger-50 text-danger-700 border border-danger-200">
                    <Ban size={10} />
                    严重 {stats.critical}
                  </span>
                  <span className="eng-tag bg-ink-100 text-ink-700 border border-ink-200">
                    <Clock size={10} />
                    待处理 {stats.open}
                  </span>
                </div>
              </div>
              <ArrowRight size={18} className="text-ink-300 group-hover:text-warn-600 group-hover:translate-x-1 transition-all" />
            </div>
          </Link>

          <Link to="/export" className="eng-card p-5 hover:border-safe-400 transition-all group">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-eng bg-safe-600 text-white flex items-center justify-center shadow-eng group-hover:scale-105 transition-transform">
                <Download size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="eng-section-title text-safe-700 mb-1">
                  报告导出区
                  <span className="font-mono text-[10px] text-safe-500 font-normal">EXPORT</span>
                </div>
                <div className="text-xs text-ink-500 mb-2">JSON / Markdown · 含历史快照</div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="eng-tag bg-safe-50 text-safe-700 border border-safe-200">
                    <CheckCircle2 size={10} />
                    已解决 {stats.resolved}
                  </span>
                  <span className="text-ink-400">→</span>
                </div>
              </div>
              <ArrowRight size={18} className="text-ink-300 group-hover:text-safe-600 group-hover:translate-x-1 transition-all" />
            </div>
          </Link>
        </div>
      </section>

      {/* 四色指标卡 */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={AlertTriangle}
          label="待复核异常"
          value={stats.open}
          trend="+2"
          trendUp={true}
          bg="from-danger-50 to-white"
          border="border-danger-200"
          text="text-danger-700"
          iconBg="bg-danger-600"
        />
        <StatCard
          icon={CheckCircle2}
          label="已解决/放行"
          value={stats.resolved}
          trend="+5"
          trendUp={false}
          bg="from-safe-50 to-white"
          border="border-safe-200"
          text="text-safe-700"
          iconBg="bg-safe-600"
        />
        <StatCard
          icon={PauseCircle}
          label="已挂起"
          value={stats.suspended}
          trend="0"
          trendUp={false}
          bg="from-warn-50 to-white"
          border="border-warn-200"
          text="text-warn-700"
          iconBg="bg-warn-600"
        />
        <StatCard
          icon={FileText}
          label="待处理纪要"
          value={stats.pendingMin}
          trend="-1"
          trendUp={false}
          bg="from-brand-50 to-white"
          border="border-brand-200"
          text="text-brand-700"
          iconBg="bg-brand-600"
        />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 异常趋势 */}
        <section className="eng-card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-ink-900 flex items-center gap-2">
              <TrendingUp size={16} className="text-brand-600" />
              近 7 天异常产生/解决趋势
            </h2>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-danger-500" />
                新增
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-safe-500" />
                解决
              </span>
            </div>
          </div>
          <div className="h-[220px] flex items-end gap-3 px-2">
            {trend.map((d) => (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full h-[170px] flex items-end gap-1">
                  <div
                    className="flex-1 bg-gradient-to-t from-danger-500 to-danger-300 rounded-t transition-all hover:from-danger-600 hover:to-danger-400"
                    style={{ height: `${(d.created / maxVal) * 100}%`, minHeight: d.created > 0 ? "8px" : "0" }}
                    title={`新增 ${d.created}`}
                  />
                  <div
                    className="flex-1 bg-gradient-to-t from-safe-500 to-safe-300 rounded-t transition-all hover:from-safe-600 hover:to-safe-400"
                    style={{ height: `${(d.closed / maxVal) * 100}%`, minHeight: d.closed > 0 ? "8px" : "0" }}
                    title={`解决 ${d.closed}`}
                  />
                </div>
                <span className="text-[11px] text-ink-500 font-mono">{d.day}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 重跑历史 */}
        <section className="eng-card p-5">
          <h2 className="text-base font-bold text-ink-900 flex items-center gap-2 mb-4">
            <PlayCircle size={16} className="text-warn-600" />
            复核运行记录
          </h2>
          {recentReruns.length === 0 ? (
            <div className="text-center py-8 text-ink-400 text-sm">
              暂无运行记录，点击右上角「重新复核」
            </div>
          ) : (
            <ul className="space-y-3">
              {recentReruns.map((r) => (
                <li key={r.runId} className="p-3 rounded-eng bg-ink-50 border border-ink-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[11px] text-brand-700 font-bold">{r.runId}</span>
                    <span className="eng-tag bg-safe-50 text-safe-700 border border-safe-200 text-[10px]">
                      {r.status === "finished" ? "成功" : r.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-ink-500">
                    <span>异常 {r.anomaliesCountBefore} → {r.anomaliesCountAfter}</span>
                    <span>保护 {r.preservedNoteIds.length} 条备注</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: number | string;
  trend: string;
  trendUp: boolean;
  bg: string;
  border: string;
  text: string;
  iconBg: string;
}

function StatCard({
  icon: Icon,
  label,
  value,
  trend,
  trendUp,
  bg,
  border,
  text,
  iconBg,
}: StatCardProps) {
  return (
    <div className={`eng-card p-5 bg-gradient-to-br ${bg} border ${border}`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-eng ${iconBg} text-white flex items-center justify-center shadow-eng`}>
          <Icon size={18} />
        </div>
        <span
          className={`text-[11px] font-bold font-mono ${
            trendUp ? "text-danger-600" : "text-safe-600"
          } eng-tag bg-white/70`}
        >
          {trend}
        </span>
      </div>
      <div className={`text-3xl font-black mb-1 ${text}`}>{value}</div>
      <div className="text-xs text-ink-500 font-medium">{label}</div>
    </div>
  );
}
