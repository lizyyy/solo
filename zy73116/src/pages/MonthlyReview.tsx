import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  Clock,
  XCircle,
  AlertOctagon,
  ChevronRight,
  AlertTriangle,
  CalendarCheck2,
  FileText,
} from "lucide-react";
import { usePreReviewStore } from "@/store/preReviewStore";
import StatusBadge from "@/components/StatusBadge";
import type { Collision, CollisionStatus } from "@/types";

type TabKey = "confirmed" | "pending" | "rejected";

const tabs: { key: TabKey; label: string; Icon: typeof CheckCircle2; accent: string }[] = [
  { key: "confirmed", label: "已确认", Icon: CheckCircle2, accent: "#10b981" },
  { key: "pending", label: "待补件", Icon: Clock, accent: "#f59e0b" },
  { key: "rejected", label: "退回", Icon: XCircle, accent: "#ef4444" },
];

export default function MonthlyReview() {
  const { getCollisionsByStatus, getVisaLine, stats } = usePreReviewStore();
  const [tab, setTab] = useState<TabKey>("pending");
  const s = useMemo(() => stats(), [stats]);

  const countBy: Record<TabKey, number> = {
    confirmed: s.confirmed,
    pending: s.pending,
    rejected: s.rejected,
  };

  const list: Collision[] = useMemo(() => getCollisionsByStatus(tab), [tab, getCollisionsByStatus]);

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink-100 flex items-center gap-2">
            <CalendarCheck2 className="w-4 h-4 text-amber-400" />
            月底复核
          </h1>
          <p className="text-xs text-ink-500 mt-0.5">结构工程师老叶 · 分类处理本月碰撞预审记录</p>
        </div>
        <div className="text-[11px] text-ink-500 font-mono-num">复核周期 · 2026-06</div>
      </div>

      <div className="flex items-center gap-1 mb-5 p-1 rounded-lg bg-ink-900/60 border border-ink-800 w-fit">
        {tabs.map(({ key, label, Icon, accent }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`relative h-9 px-4 rounded-md flex items-center gap-2 text-xs font-medium transition ${
              tab === key ? "bg-ink-800 text-ink-100 shadow" : "text-ink-400 hover:text-ink-200"
            }`}
          >
            <Icon className="w-3.5 h-3.5" style={{ color: tab === key ? accent : undefined }} />
            {label}
            <span
              className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-mono-num"
              style={{
                background: tab === key ? `${accent}20` : "#1e293b",
                color: tab === key ? accent : "#94a3b8",
              }}
            >
              {countBy[key]}
            </span>
          </button>
        ))}
      </div>

      <section className="rounded-lg border border-ink-800 bg-ink-900/60 overflow-hidden">
        <div className="px-4 py-3 border-b border-ink-800 flex items-center justify-between">
          <div className="text-sm font-medium text-ink-100">
            {tabs.find((t) => t.key === tab)?.label} 记录 · {list.length} 条
          </div>
          <div className="text-[11px] text-ink-500">点击行查看详情 · 可跳转签证单定位</div>
        </div>

        {list.length === 0 ? (
          <div className="px-4 py-16 text-center text-sm text-ink-500">暂无{tabs.find((t) => t.key === tab)?.label}记录</div>
        ) : (
          <ul className="divide-y divide-ink-800/60">
            {list.map((c) => {
              const visa = getVisaLine(c.visaLineId);
              return (
                <li
                  key={c.id}
                  className={`px-4 py-3 hover:bg-ink-800/40 transition ${
                    c.isDuplicate ? "bg-red-500/[0.03]" : ""
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className="w-10 h-10 rounded-md flex items-center justify-center shrink-0"
                      style={{ background: `${tabs.find((t) => t.key === tab)?.accent}15` }}
                    >
                      {(() => {
                        const T = tabs.find((t) => t.key === tab)!.Icon;
                        return <T className="w-5 h-5" style={{ color: tabs.find((t) => t.key === tab)!.accent }} />;
                      })()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono-num text-xs text-ink-200">{c.pointCode}</span>
                        <StatusBadge status={c.status as CollisionStatus} isDuplicate={c.isDuplicate} />
                        {c.isDuplicate && (
                          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 bg-red-500/15 text-red-400 border border-red-500/30 text-[10px] font-medium">
                            <AlertOctagon className="w-3 h-3" />
                            重复×{c.duplicateCount}
                          </span>
                        )}
                        <span className="text-[11px] text-ink-500">·</span>
                        <span className="text-[11px] text-ink-400">
                          {c.building} · {c.floor}层
                        </span>
                        <span className="text-[11px] text-ink-500">·</span>
                        <span className="text-[11px] text-ink-500 font-mono-num">{c.reviewDate}</span>
                      </div>
                      <div className="mt-1 text-xs text-ink-300">{c.description}</div>

                      {c.isDuplicate && c.duplicateReason && (
                        <div className="mt-2.5 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 flex items-start gap-2">
                          <AlertOctagon className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                          <div>
                            <div className="text-[11px] font-medium text-red-400">异常原因</div>
                            <div className="text-[12px] text-red-200/90 mt-0.5">{c.duplicateReason}</div>
                          </div>
                        </div>
                      )}

                      <div className="mt-2.5 flex items-center gap-3 flex-wrap">
                        <div className="inline-flex items-center gap-1.5 rounded-md bg-ink-800/80 border border-ink-700 px-2.5 py-1">
                          <FileText className="w-3 h-3 text-amber-400" />
                          {visa ? (
                            <Link
                              to={`/visa/${visa.visaNo}`}
                              className="text-[11px] font-mono-num text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-1"
                            >
                              {visa.visaNo} · L{visa.lineNo}
                              <ChevronRight className="w-3 h-3" />
                            </Link>
                          ) : (
                            <span className="text-[11px] text-ink-500">未关联签证</span>
                          )}
                        </div>
                        <div className="text-[11px] text-ink-500 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-ink-500" />
                          截图视角: {c.screenshot.viewpoint}
                        </div>
                        <div className="text-[11px] text-ink-500 font-mono-num">坐标: {c.screenshot.coords}</div>
                      </div>
                    </div>
                    <Link
                      to="/"
                      className="shrink-0 h-8 px-3 rounded-md border border-ink-700 bg-ink-800 text-[11px] text-ink-300 hover:text-ink-100 hover:border-ink-600 flex items-center gap-1.5 transition"
                    >
                      预审面板
                      <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="mt-5 grid grid-cols-3 gap-3">
        {tabs.map(({ key, label, accent, Icon }) => (
          <div
            key={key}
            className="rounded-lg border border-ink-800 bg-ink-900/60 px-4 py-3 flex items-center gap-3"
          >
            <div
              className="w-9 h-9 rounded-md flex items-center justify-center"
              style={{ background: `${accent}15` }}
            >
              <Icon className="w-4 h-4" style={{ color: accent }} />
            </div>
            <div>
              <div className="text-[11px] text-ink-500">本月 {label}</div>
              <div className="text-lg font-mono-num font-semibold" style={{ color: accent }}>
                {countBy[key]}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
