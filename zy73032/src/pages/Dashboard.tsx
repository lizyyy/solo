import { Link } from "react-router-dom";
import { ArrowRight, Upload, FileText, AlertTriangle } from "lucide-react";
import { useReconcileStore } from "@/store/useReconcileStore";
import StatsGrid from "@/components/StatsGrid";
import OnboardingSidebar from "@/components/OnboardingSidebar";

export default function Dashboard() {
  const { getStats, getConflictSummary, schedules, medicalRecords, getAliasConflicts } =
    useReconcileStore();
  const stats = getStats();
  const conflictSummary = getConflictSummary();
  const conflicts = getAliasConflicts();
  const topConflicts = conflicts.slice(0, 2);
  const recentSchedules = [...schedules]
    .sort((a, b) => (b.courseDate > a.courseDate ? 1 : -1))
    .slice(0, 5);
  const recentMedical = medicalRecords.slice(0, 3);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5">
      <div className="space-y-5 min-w-0">
        <StatsGrid stats={stats} conflictSummary={conflictSummary} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <QuickActionCard
            title="导入训练课CSV"
            desc="把训练组导出的明细接进来，自动识别表头"
            to="/import"
            icon={Upload}
            tone="brand"
          />
          <QuickActionCard
            title="录入手写病历"
            desc="保留病历与排程的关联，附带一条正常样例"
            to="/import#medical"
            icon={FileText}
            tone="success"
          />
          <QuickActionCard
            title="处理别名冲突"
            desc={`${conflictSummary.namesAffected} 个名字待补看`}
            to="/anomalies"
            icon={AlertTriangle}
            tone="danger"
            highlight={conflictSummary.namesAffected > 0}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <section className="card">
            <SectionTitle title="最近排程（按日期）" to="/schedules" />
            <div className="divide-y divide-warm-100">
              {recentSchedules.map((s) => (
                <div
                  key={s.id}
                  className="px-5 py-3 flex items-center gap-3 hover:bg-warm-50"
                >
                  <div className="w-11 text-center">
                    <div className="text-xs text-warm-500">
                      {s.courseDate.slice(5)}
                    </div>
                    <div className="text-[10px] text-warm-400">{s.durationMin}m</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-warm-800 font-medium">
                        {s.petName}
                      </span>
                      <StatusTag status={s.status} />
                    </div>
                    <div className="text-xs text-warm-500 truncate">
                      {s.courseName} · {s.trainer}
                    </div>
                  </div>
                  <Link
                    to={`/schedules?id=${s.id}`}
                    className="text-[11px] text-brand-700 hover:text-brand-800"
                  >
                    详情 →
                  </Link>
                </div>
              ))}
              {recentSchedules.length === 0 && (
                <div className="px-5 py-6 text-xs text-warm-500 text-center">
                  暂无排程，先去导入CSV吧
                </div>
              )}
            </div>
          </section>

          <section className="card">
            <SectionTitle title="待处理别名冲突" to="/anomalies" />
            <div className="divide-y divide-warm-100">
              {topConflicts.map((c) => (
                <div key={c.aliasName} className="px-5 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="tag-anomaly">别名冲突</span>
                      <span className="font-serif text-warm-800 font-semibold">
                        「{c.aliasName}」
                      </span>
                    </div>
                    <Link
                      to="/anomalies"
                      className="text-[11px] text-danger-700 hover:text-danger-800"
                    >
                      去处理 →
                    </Link>
                  </div>
                  <div className="text-xs text-warm-500 space-y-1">
                    <div>
                      来源：
                      {c.sourceRecords.length === 0 ? (
                        <span className="text-warm-400">未绑定到任何规范宠物</span>
                      ) : (
                        c.sourceRecords
                          .map((r) =>
                            r.type === "CSV" ? `CSV·${r.label}` : `病历·${r.label}`
                          )
                          .join("；")
                      )}
                    </div>
                    <div>
                      影响：{c.affectedScheduleIds.length} 条排程，
                      {c.affectedMedicalIds.length} 份病历
                    </div>
                  </div>
                </div>
              ))}
              {topConflicts.length === 0 && (
                <div className="px-5 py-6 text-xs text-warm-500 text-center">
                  🎉 没有别名冲突，数据干净
                </div>
              )}
            </div>
          </section>
        </div>

        <section className="card">
          <SectionTitle title="最近手写病历" to="/schedules" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-warm-100">
            {recentMedical.map((m) => (
              <div key={m.id} className="bg-white px-5 py-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-warm-800">
                    {m.petName}
                  </span>
                  <span className="text-[10px] text-warm-500">{m.visitDate}</span>
                </div>
                <div className="text-xs text-warm-700 mb-1">
                  <b>诊断：</b>
                  {m.diagnosis}
                </div>
                <div className="text-xs text-warm-500 line-clamp-2">
                  {m.treatment}
                </div>
                <div className="mt-2 text-[10px] text-warm-400">
                  医生：{m.veterinarian}
                  {m.linkedScheduleId ? " · 已关联排程" : " · 未关联排程"}
                </div>
              </div>
            ))}
            {recentMedical.length === 0 && (
              <div className="md:col-span-3 py-6 text-xs text-warm-500 text-center">
                还没有病历记录，去「导入中心」录入吧
              </div>
            )}
          </div>
        </section>
      </div>

      <OnboardingSidebar />
    </div>
  );
}

function QuickActionCard({
  title,
  desc,
  to,
  icon: Icon,
  tone,
  highlight,
}: {
  title: string;
  desc: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "brand" | "success" | "danger";
  highlight?: boolean;
}) {
  const toneMap = {
    brand: "bg-brand-600 hover:bg-brand-700",
    success: "bg-success-600 hover:bg-success-700",
    danger: "bg-danger-600 hover:bg-danger-700",
  } as const;
  return (
    <Link
      to={to}
      className={`card p-5 block group hover:shadow-soft transition-all ${
        highlight ? "animate-pulseSoft" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div
          className={`w-11 h-11 rounded-xl text-white flex items-center justify-center ${toneMap[tone]}`}
        >
          <Icon className="w-5 h-5" />
        </div>
        <ArrowRight className="w-4 h-4 text-warm-400 group-hover:text-brand-600 group-hover:translate-x-0.5 transition" />
      </div>
      <div className="text-warm-800 font-medium">{title}</div>
      <div className="text-xs text-warm-500 mt-1 leading-relaxed">{desc}</div>
    </Link>
  );
}

function SectionTitle({ title, to }: { title: string; to?: string }) {
  return (
    <div className="px-5 py-3 border-b border-warm-100 flex items-center justify-between">
      <h2 className="text-sm font-serif font-semibold text-warm-800">{title}</h2>
      {to && (
        <Link to={to} className="text-[11px] text-brand-700 hover:text-brand-800">
          查看全部 →
        </Link>
      )}
    </div>
  );
}

function StatusTag({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: "tag-pending",
    CONFIRMED: "tag-confirmed",
    WITHDRAWN: "tag-withdrawn",
    ANOMALY: "tag-anomaly",
  };
  const label: Record<string, string> = {
    PENDING: "待确认",
    CONFIRMED: "已确认",
    WITHDRAWN: "已撤回",
    ANOMALY: "异常",
  };
  return <span className={map[status] || "tag"}>{label[status] || status}</span>;
}
