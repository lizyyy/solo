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
  FileText,
  Ruler,
  FilePlus2,
  FileBarChart,
  ExternalLink,
  ArrowRightLeft,
} from "lucide-react";
import { usePreReviewStore } from "@/store/preReviewStore";
import { BUILDINGS, FLOORS } from "@/data/mockData";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";
import type { Collision, CollisionStatus } from "@/types";

const selectCls =
  "h-8 px-2.5 rounded-md bg-ink-800 border border-ink-700 text-ink-200 text-xs focus:border-amber-500/60 focus:outline-none focus:ring-1 focus:ring-amber-500/30 transition";

export default function PreReview() {
  const {
    filters,
    setFilters,
    resetFilters,
    filteredCollisions,
    stats,
    getVisaLine,
    setExpanded,
    expandedCollisionId,
    markCollision,
    getBoundaryByCollision,
    getSupplementsByCollision,
    getCollisionById,
    getVisaNos,
    boundarySamples,
    supplements,
    visaLines,
  } = usePreReviewStore();

  const collisions = useMemo(() => filteredCollisions(), [filters, filteredCollisions]);
  const s = useMemo(() => stats(), [filters, stats]);
  const [menu, setMenu] = useState<string | null>(null);
  const visaNos = useMemo(() => getVisaNos(), [getVisaNos]);

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink-100">预审面板</h1>
          <p className="text-xs text-ink-500 mt-0.5">筛选、统计、明细、截图说明、材料区 — 来自同一套结果</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-[11px] text-ink-500 font-mono-num">数据源 · preReviewStore.filteredCollisions()</div>
          <Link
            to="/report"
            className="h-8 px-3 rounded-md bg-gradient-to-br from-amber-500 to-orange-500 text-ink-950 hover:from-amber-400 hover:to-orange-400 text-xs font-semibold flex items-center gap-1.5 transition shadow-lg shadow-amber-900/20"
          >
            <FileBarChart className="w-3.5 h-3.5" />
            生成预审报告
          </Link>
        </div>
      </div>

      <section className="rounded-lg border border-ink-800 bg-ink-900/60 p-4 mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <Field label="楼栋" icon={<Building2 className="w-3.5 h-3.5" />}>
            <select className={selectCls} value={filters.building} onChange={(e) => setFilters({ building: e.target.value })}>
              <option value="">全部楼栋</option>
              {BUILDINGS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </Field>
          <Field label="楼层" icon={<Layers className="w-3.5 h-3.5" />}>
            <select className={selectCls} value={filters.floor} onChange={(e) => setFilters({ floor: e.target.value })}>
              <option value="">全部楼层</option>
              {FLOORS.map((f) => (
                <option key={f} value={String(f)}>{f}层</option>
              ))}
            </select>
          </Field>
          <Field label="起" icon={<CalendarRange className="w-3.5 h-3.5" />}>
            <input type="date" className={selectCls} value={filters.dateFrom} onChange={(e) => setFilters({ dateFrom: e.target.value })} />
          </Field>
          <Field label="止" icon={<CalendarRange className="w-3.5 h-3.5" />}>
            <input type="date" className={selectCls} value={filters.dateTo} onChange={(e) => setFilters({ dateTo: e.target.value })} />
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
        <StatCard label="异常重复" value={s.duplicates} accent="#f43f5e" icon={<Copy className="w-5 h-5" />} sub="已标注异常原因 · 不因状态消除" />
      </section>

      <section className="grid grid-cols-3 gap-3 mb-5">
        <MaterialNavCard
          title="现场签证单"
          accent="#f59e0b"
          icon={<FileText className="w-4 h-4" />}
          count={visaNos.length}
          desc={`${visaLines.length} 行记录 · 含行级偏移追踪`}
          to="/visa"
        />
        <MaterialNavCard
          title="边界样本"
          accent="#a78bfa"
          icon={<Ruler className="w-4 h-4" />}
          count={boundarySamples.length}
          desc={`阈值对照 · 关联碰撞点与签证行`}
          to="/report"
        />
        <MaterialNavCard
          title="后补说明"
          accent="#22d3ee"
          icon={<FilePlus2 className="w-4 h-4" />}
          count={supplements.length}
          desc={`设计复核 · 施工补件说明`}
          to="/report"
        />
      </section>

      <section className="rounded-lg border border-ink-800 bg-ink-900/60 overflow-hidden">
        <div className="px-4 py-3 border-b border-ink-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-ink-100">碰撞明细表</span>
            <span className="text-[11px] text-ink-500 font-mono-num">
              {collisions.length} 条 · 点击行展开：截图 / 异常原因 / 签证行 / 边界样本 / 后补说明
            </span>
          </div>
          <div className="text-[11px] text-ink-500">统一数据源 · 与上方统计完全一致 · 重复异常不因状态改变消失</div>
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
                <th className="text-left font-medium px-3 py-2.5">材料</th>
                <th className="text-left font-medium px-3 py-2.5">日期</th>
                <th className="text-left font-medium px-3 py-2.5">状态</th>
                <th className="text-left font-medium px-3 py-2.5 w-28">操作</th>
              </tr>
            </thead>
            <tbody>
              {collisions.map((c, idx) => {
                const visa = getVisaLine(c.visaLineId);
                const boundary = getBoundaryByCollision(c.id);
                const sups = getSupplementsByCollision(c.id);
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
                      <td className="px-3 py-2.5 text-xs text-ink-300">{c.building} · {c.floor}层</td>
                      <td className="px-3 py-2.5 text-xs text-ink-300 max-w-[280px] truncate">{c.description}</td>
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
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          {visa && <MatChip label="签" accent="#f59e0b" title="已关联现场签证单" />}
                          {boundary && <MatChip label="界" accent="#a78bfa" title="已关联边界样本" />}
                          {sups.length > 0 && <MatChip label="补" accent="#22d3ee" title={`${sups.length}条后补说明`} />}
                          {!visa && !boundary && sups.length === 0 && (
                            <span className="text-[10px] text-ink-600">无</span>
                          )}
                        </div>
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
                    {expanded && <ExpandRow c={c} visa={visa} boundary={boundary} supplements={sups} getCollisionById={getCollisionById} />}
                  </Fragment>
                );
              })}
              {collisions.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center text-sm text-ink-500">
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

function ExpandRow({
  c,
  visa,
  boundary,
  supplements,
  getCollisionById,
}: {
  c: Collision;
  visa: any;
  boundary: any;
  supplements: any[];
  getCollisionById: (id: string) => Collision | undefined;
}) {
  return (
    <tr className="bg-ink-850/40 border-t border-ink-800/40">
      <td colSpan={9} className="px-4 py-4">
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-4 space-y-3">
            <div className="col-span-5 rounded-md overflow-hidden border border-ink-700 bg-ink-900 relative group">
              <img src={c.screenshot.url} alt={c.pointCode} className="w-full h-[200px] object-cover" />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-ink-950/90 to-transparent px-3 py-2 flex items-center gap-2">
                <ImageIcon className="w-3.5 h-3.5 text-ink-300" />
                <span className="text-[11px] text-ink-200">{c.screenshot.id}</span>
              </div>
            </div>
            <InfoRow icon={<Eye className="w-3.5 h-3.5" />} label="截图视角">{c.screenshot.viewpoint}</InfoRow>
            <InfoRow icon={<MapPin className="w-3.5 h-3.5" />} label="BIM坐标"><span className="font-mono-num">{c.screenshot.coords}</span></InfoRow>
            <InfoRow icon={<AlertTriangle className="w-3.5 h-3.5" />} label="现场说明">{c.screenshot.note}</InfoRow>
          </div>

          <div className="col-span-8 space-y-3">
            {c.isDuplicate && c.duplicateReason && (
              <div className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2.5">
                <div className="flex items-start gap-2">
                  <AlertOctagon className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <div className="text-[11px] font-medium text-red-400 flex items-center gap-1.5">
                      异常原因 · 碰撞点重复
                      <span className="px-1.5 py-0.5 rounded bg-red-500/15 border border-red-500/30 text-[10px] font-mono-num">重复×{c.duplicateCount} · 不因状态消除</span>
                    </div>
                    <div className="text-[12px] text-red-200/90 mt-1">{c.duplicateReason}</div>
                    {c.relatedDuplicateIds && c.relatedDuplicateIds.length > 0 && (
                      <div className="mt-2 text-[11px] text-red-300/80 flex items-center gap-1.5 flex-wrap">
                        <ArrowRightLeft className="w-3 h-3" />
                        <span>关联重复记录：</span>
                        {c.relatedDuplicateIds.map((rid) => {
                          const r = getCollisionById(rid);
                          if (!r) return null;
                          const statusText = r.status === "confirmed" ? "已确认" : r.status === "pending" ? "待补件" : "退回";
                          return (
                            <span key={rid} className="inline-flex items-center gap-1 rounded bg-ink-900/80 border border-red-500/20 px-1.5 py-0.5 font-mono-num text-[10px]">
                              {r.pointCode}
                              <span className="text-ink-500">→</span>
                              {statusText}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <MaterialBlock
                title="现场签证单"
                icon={<FileText className="w-3.5 h-3.5" />}
                accent="#f59e0b"
                emptyText="无关联签证行"
              >
                {visa ? (
                  <div>
                    <Link to={`/visa/${visa.visaNo}`} className="text-[12px] text-amber-400 hover:text-amber-300 hover:underline font-mono-num inline-flex items-center gap-1">
                      {visa.visaNo} · 第{visa.lineNo}行 <ExternalLink className="w-3 h-3" />
                    </Link>
                    <div className="text-[11px] text-ink-300 mt-1">{visa.content}</div>
                    <div className={`mt-1 text-[11px] font-mono-num ${visa.causesBias ? "text-red-400" : "text-ink-400"}`}>
                      偏移 {visa.offsetMm > 0 ? `+${visa.offsetMm}` : visa.offsetMm}mm
                      {visa.causesBias && " · 拖偏预审来源"}
                    </div>
                  </div>
                ) : null}
              </MaterialBlock>

              <MaterialBlock
                title="边界样本"
                icon={<Ruler className="w-3.5 h-3.5" />}
                accent="#a78bfa"
                emptyText="该碰撞点未超出边界阈值"
              >
                {boundary ? (
                  <div>
                    <div className="text-[12px] font-mono-num text-ink-100">{boundary.code}</div>
                    <div className="text-[11px] text-ink-400 mt-0.5">{boundary.description}</div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-[11px] text-ink-500">阈值±{boundary.thresholdMm}mm</span>
                      <span className="text-ink-600">→</span>
                      <span className="text-[11px] font-mono-num text-red-400">实测+{boundary.measuredMm}mm</span>
                    </div>
                    <div className="text-[11px] text-violet-300/90 mt-1">签证行 L{boundary.visaLineNo} · {boundary.remark}</div>
                  </div>
                ) : null}
              </MaterialBlock>

              <MaterialBlock
                title="后补说明"
                icon={<FilePlus2 className="w-3.5 h-3.5" />}
                accent="#22d3ee"
                emptyText={c.status === "pending" ? "待补交材料" : "无后补说明"}
                emptyAccent={c.status === "pending" ? "#f59e0b" : undefined}
              >
                {supplements.length > 0 ? (
                  <div className="space-y-2">
                    {supplements.map((s) => (
                      <div key={s.id}>
                        <div className="text-[12px] text-ink-200">{s.title}</div>
                        <div className="text-[11px] text-ink-400 mt-0.5 line-clamp-2">{s.content}</div>
                        <div className="text-[10px] text-ink-500 mt-0.5 font-mono-num">{s.date} · {s.author}</div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </MaterialBlock>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-[11px] text-ink-400 flex items-center gap-1 shrink-0">{icon}{label}</span>
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

function MaterialNavCard({
  title, icon, accent, count, desc, to,
}: { title: string; icon: React.ReactNode; accent: string; count: number; desc: string; to: string }) {
  return (
    <Link
      to={to}
      className="group rounded-lg border border-ink-800 bg-ink-900/60 px-4 py-3 flex items-center gap-3 hover:border-opacity-80 hover:bg-ink-850/60 transition"
      style={{ borderColor: `${accent}30` }}
    >
      <div className="w-10 h-10 rounded-md flex items-center justify-center" style={{ background: `${accent}15`, color: accent }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-ink-100">{title}</span>
          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-mono-num" style={{ background: `${accent}20`, color: accent }}>
            {count}
          </span>
        </div>
        <div className="text-[11px] text-ink-500 mt-0.5 truncate">{desc}</div>
      </div>
      <ChevronRight className="w-4 h-4 text-ink-600 group-hover:text-ink-300 transition" />
    </Link>
  );
}

function MatChip({ label, accent, title }: { label: string; accent: string; title: string }) {
  return (
    <span
      title={title}
      className="inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-semibold border"
      style={{ background: `${accent}18`, color: accent, borderColor: `${accent}40` }}
    >
      {label}
    </span>
  );
}

function MaterialBlock({
  title, icon, accent, children, emptyText, emptyAccent,
}: { title: string; icon: React.ReactNode; accent: string; children: React.ReactNode; emptyText: string; emptyAccent?: string }) {
  const hasContent = children && (children as any[]).length !== undefined ? (children as any[]).length > 0 : !!children;
  return (
    <div className="rounded-md border border-ink-700/60 bg-ink-850/50 p-3">
      <div className="flex items-center gap-1.5 mb-2" style={{ color: accent }}>
        {icon}
        <span className="text-[11px] font-medium">{title}</span>
      </div>
      {hasContent ? children : (
        <span className="text-[11px]" style={{ color: emptyAccent || "#475569" }}>{emptyText}</span>
      )}
    </div>
  );
}
