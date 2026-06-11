import { Fragment, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  Layers,
  CalendarRange,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Image as ImageIcon,
  MapPin,
  Eye,
  CheckCircle2,
  Clock,
  XCircle,
  Copy,
  AlertOctagon,
} from "lucide-react";
import { usePreReviewStore } from "@/store/preReviewStore";
import { BUILDINGS, FLOORS } from "@/data/mockData";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";
import type { CollisionStatus } from "@/types";

const selectCls =
  "h-8 px-2.5 rounded-md bg-ink-800 border border-ink-700 text-ink-200 text-xs focus:border-amber-500/60 focus:outline-none focus:ring-1 focus:ring-amber-500/30 transition";

export default function PreReview() {
  const { filters, setFilters, resetFilters, filteredCollisions, stats, getVisaLine, setExpanded, expandedCollisionId, markCollision } =
    usePreReviewStore();

  const collisions = useMemo(() => filteredCollisions(), [filters, filteredCollisions]);
  const s = useMemo(() => stats(), [filters, stats]);
  const [menu, setMenu] = useState<string | null>(null);

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink-100">预审面板</h1>
          <p className="text-xs text-ink-500 mt-0.5">筛选、统计、明细、截图说明 — 来自同一套结果</p>
        </div>
        <div className="text-[11px] text-ink-500 font-mono-num">数据源 · preReviewStore.filteredCollisions()</div>
      </div>

      <section className="rounded-lg border border-ink-800 bg-ink-900/60 p-4 mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <Field label="楼栋" icon={<Building2 className="w-3.5 h-3.5" />}>
            <select className={selectCls} value={filters.building} onChange={(e) => setFilters({ building: e.target.value })}>
              <option value="">全部楼栋</option>
              {BUILDINGS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </Field>
          <Field label="楼层" icon={<Layers className="w-3.5 h-3.5" />}>
            <select className={selectCls} value={filters.floor} onChange={(e) => setFilters({ floor: e.target.value })}>
              <option value="">全部楼层</option>
              {FLOORS.map((f) => (
                <option key={f} value={String(f)}>
                  {f}层
                </option>
              ))}
            </select>
          </Field>
          <Field label="起" icon={<CalendarRange className="w-3.5 h-3.5" />}>
            <input
              type="date"
              className={selectCls}
              value={filters.dateFrom}
              onChange={(e) => setFilters({ dateFrom: e.target.value })}
            />
          </Field>
          <Field label="止" icon={<CalendarRange className="w-3.5 h-3.5" />}>
            <input
              type="date"
              className={selectCls}
              value={filters.dateTo}
              onChange={(e) => setFilters({ dateTo: e.target.value })}
            />
          </Field>
          <Field label="状态">
            <select
              className={selectCls}
              value={filters.status}
              onChange={(e) => setFilters({ status: e.target.value as CollisionStatus | "all" })}
            >
              <option value="all">全部状态</option>
              <option value="confirmed">已确认</option>
              <option value="pending">待补件</option>
              <option value="rejected">退回</option>
            </select>
          </Field>
          <div className="flex-1" />
          <button
            onClick={resetFilters}
            className="h-8 px-3 rounded-md border border-ink-700 bg-ink-800 text-ink-300 hover:text-ink-100 hover:border-ink-600 text-xs flex items-center gap-1.5 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            重置筛选
          </button>
        </div>
      </section>

      <section className="grid grid-cols-5 gap-3 mb-5">
        <StatCard label="总碰撞" value={s.total} accent="#94a3b8" icon={<AlertTriangle className="w-5 h-5" />} sub="本月筛选结果" />
        <StatCard label="已确认" value={s.confirmed} accent="#10b981" icon={<CheckCircle2 className="w-5 h-5" />} sub="流程通过" />
        <StatCard label="待补件" value={s.pending} accent="#f59e0b" icon={<Clock className="w-5 h-5" />} sub="缺材料待补" />
        <StatCard label="退回" value={s.rejected} accent="#ef4444" icon={<XCircle className="w-5 h-5" />} sub="需重报" />
        <StatCard
          label="异常重复"
          value={s.duplicates}
          accent="#f43f5e"
          icon={<Copy className="w-5 h-5" />}
          sub="已标注异常原因"
        />
      </section>

      <section className="rounded-lg border border-ink-800 bg-ink-900/60 overflow-hidden">
        <div className="px-4 py-3 border-b border-ink-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-ink-100">碰撞明细表</span>
            <span className="text-[11px] text-ink-500 font-mono-num">
              {collisions.length} 条 · 点击行展开截图与签证引用
            </span>
          </div>
          <div className="text-[11px] text-ink-500">统一数据源 · 与上方统计完全一致</div>
        </div>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] text-ink-400 uppercase tracking-wider bg-ink-900/60">
                <th className="text-left font-medium px-4 py-2.5 w-8"></th>
                <th className="text-left font-medium px-3 py-2.5">碰撞点编码</th>
                <th className="text-left font-medium px-3 py-2.5">位置</th>
                <th className="text-left font-medium px-3 py-2.5">描述</th>
                <th className="text-left font-medium px-3 py-2.5">签证单</th>
                <th className="text-left font-medium px-3 py-2.5">日期</th>
                <th className="text-left font-medium px-3 py-2.5">状态</th>
                <th className="text-left font-medium px-3 py-2.5 w-28">操作</th>
              </tr>
            </thead>
            <tbody>
              {collisions.map((c, idx) => {
                const visa = getVisaLine(c.visaLineId);
                const expanded = expandedCollisionId === c.id;
                return (
                  <Fragment key={c.id}>
                    <tr
                      className={`border-t border-ink-800/60 cursor-pointer transition ${
                        idx % 2 === 0 ? "bg-ink-900/20" : ""
                      } ${c.isDuplicate ? "bg-red-500/[0.04]" : ""} hover:bg-ink-800/40`}
                      onClick={() => setExpanded(expanded ? null : c.id)}
                    >
                      <td className="px-4 py-2.5">
                        {expanded ? (
                          <ChevronDown className="w-4 h-4 text-ink-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-ink-500" />
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono-num text-xs text-ink-200">{c.pointCode}</span>
                          {c.isDuplicate && (
                            <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 bg-red-500/15 text-red-400 border border-red-500/30 text-[10px] font-medium">
                              <AlertOctagon className="w-3 h-3" />
                              重复×{c.duplicateCount}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-ink-300">
                        {c.building} · {c.floor}层
                      </td>
                      <td className="px-3 py-2.5 text-xs text-ink-300 max-w-[320px] truncate">{c.description}</td>
                      <td className="px-3 py-2.5">
                        {visa ? (
                          <Link
                            to={`/visa/${visa.visaNo}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-mono-num text-xs text-amber-400 hover:text-amber-300 hover:underline"
                          >
                            {visa.visaNo} · L{visa.lineNo}
                          </Link>
                        ) : (
                          <span className="text-ink-500 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-mono-num text-xs text-ink-400">{c.reviewDate}</td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={c.status} isDuplicate={c.isDuplicate} />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="relative" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setMenu(menu === c.id ? null : c.id)}
                            className="h-7 px-2.5 rounded border border-ink-700 bg-ink-800 text-[11px] text-ink-200 hover:border-ink-600 hover:text-ink-100 transition flex items-center gap-1"
                          >
                            标记状态
                            <ChevronDown className="w-3 h-3" />
                          </button>
                          {menu === c.id && (
                            <div className="absolute right-0 top-8 z-20 w-28 rounded-md border border-ink-700 bg-ink-850 shadow-xl py-1">
                              {(["confirmed", "pending", "rejected"] as CollisionStatus[]).map((st) => (
                                <button
                                  key={st}
                                  onClick={() => {
                                    markCollision(c.id, st);
                                    setMenu(null);
                                  }}
                                  className="w-full text-left px-3 py-1.5 text-[11px] text-ink-200 hover:bg-ink-700/60 transition"
                                >
                                  标为 {st === "confirmed" ? "已确认" : st === "pending" ? "待补件" : "退回"}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="bg-ink-850/40 border-t border-ink-800/40">
                        <td colSpan={8} className="px-4 py-4">
                          <div className="grid grid-cols-12 gap-4">
                            <div className="col-span-5 rounded-md overflow-hidden border border-ink-700 bg-ink-900 relative group">
                              <img
                                src={c.screenshot.url}
                                alt={c.pointCode}
                                className="w-full h-[220px] object-cover"
                              />
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-ink-950/90 to-transparent px-3 py-2 flex items-center gap-2">
                                <ImageIcon className="w-3.5 h-3.5 text-ink-300" />
                                <span className="text-[11px] text-ink-200">{c.screenshot.id}</span>
                              </div>
                            </div>
                            <div className="col-span-7 space-y-3">
                              <InfoRow icon={<Eye className="w-3.5 h-3.5" />} label="截图视角">
                                {c.screenshot.viewpoint}
                              </InfoRow>
                              <InfoRow icon={<MapPin className="w-3.5 h-3.5" />} label="BIM坐标">
                                <span className="font-mono-num">{c.screenshot.coords}</span>
                              </InfoRow>
                              <InfoRow icon={<AlertTriangle className="w-3.5 h-3.5" />} label="现场说明">
                                {c.screenshot.note}
                              </InfoRow>
                              {c.isDuplicate && (
                                <div className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2.5">
                                  <div className="flex items-start gap-2">
                                    <AlertOctagon className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                                    <div>
                                      <div className="text-[11px] font-medium text-red-400">异常原因 · 碰撞点重复</div>
                                      <div className="text-[12px] text-red-200/90 mt-0.5">{c.duplicateReason}</div>
                                    </div>
                                  </div>
                                </div>
                              )}
                              {visa && (
                                <div className="rounded-md border border-amber-500/20 bg-amber-500/[0.04] px-3 py-2.5">
                                  <div className="text-[11px] text-ink-400 mb-1">关联签证行</div>
                                  <div className="flex items-center justify-between">
                                    <div className="text-xs text-ink-200">
                                      <span className="font-mono-num text-amber-400">{visa.visaNo}</span> · 第{" "}
                                      <span className="font-mono-num text-amber-300">{visa.lineNo}</span> 行 ·{" "}
                                      {visa.content}
                                    </div>
                                    <Link
                                      to={`/visa/${visa.visaNo}`}
                                      className="text-[11px] text-amber-400 hover:text-amber-300 hover:underline"
                                    >
                                      查看签证单 →
                                    </Link>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {collisions.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-sm text-ink-500">
                    当前筛选条件下无碰撞记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-[11px] text-ink-400 flex items-center gap-1 shrink-0">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}

function InfoRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 text-ink-500">{icon}</div>
      <div className="flex-1">
        <div className="text-[11px] text-ink-500">{label}</div>
        <div className="text-[13px] text-ink-100 mt-0.5">{children}</div>
      </div>
    </div>
  );
}
