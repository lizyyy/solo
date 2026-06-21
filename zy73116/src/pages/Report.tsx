import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  FileText,
  AlertOctagon,
  AlertTriangle,
  Image as ImageIcon,
  MapPin,
  Eye,
  Ruler,
  FilePlus2,
  ArrowLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  FileWarning,
} from "lucide-react";
import { usePreReviewStore } from "@/store/preReviewStore";
import StatusBadge from "@/components/StatusBadge";
import type { Collision, CollisionStatus } from "@/types";

const statusLabel: Record<CollisionStatus, string> = {
  confirmed: "已确认",
  pending: "待补件",
  rejected: "退回",
};

export default function Report() {
  const { collisions, filteredCollisions, stats, getVisaLine, getBoundaryByCollision, getSupplementsByCollision, getCollisionById, filters } =
    usePreReviewStore();

  const list = useMemo(() => filteredCollisions(), [filters, filteredCollisions]);
  const s = useMemo(() => stats(), [filters, stats]);
  const duplicates = list.filter((c) => c.isDuplicate);
  const biasRelated = list.filter((c) => {
    const v = getVisaLine(c.visaLineId);
    return v?.causesBias;
  });

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="h-8 w-8 rounded-md border border-ink-700 bg-ink-800 text-ink-300 hover:text-ink-100 hover:border-ink-600 flex items-center justify-center transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-ink-100 flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-400" />
              碰撞预审报告
            </h1>
            <p className="text-xs text-ink-500 mt-0.5">
              筛选区间 {filters.dateFrom} ~ {filters.dateTo} · 共 {s.total} 条 · 异常重复 {s.duplicates} 条
            </p>
          </div>
        </div>
        <div className="text-[11px] text-ink-500 font-mono-num">生成时间 · 2026-06-21 结构工程师·老叶</div>
      </div>

      <section className="grid grid-cols-4 gap-3 mb-6">
        <ReportStat label="总碰撞" value={s.total} accent="#94a3b8" Icon={AlertTriangle} />
        <ReportStat label="异常重复" value={duplicates.length} accent="#f43f5e" Icon={AlertOctagon} sub="不得视为顺利通过" />
        <ReportStat label="拖偏来源" value={biasRelated.length} accent="#f59e0b" Icon={Ruler} sub="签证单行偏移超阈值" />
        <ReportStat label="待补材料" value={s.pending} accent="#f59e0b" Icon={FilePlus2} />
      </section>

      {duplicates.length > 0 && (
        <section className="rounded-lg border border-red-500/30 bg-red-500/[0.04] p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertOctagon className="w-4 h-4 text-red-400" />
            <div className="text-sm font-semibold text-red-300">异常重复碰撞（不可视为顺利通过）</div>
            <div className="text-[11px] text-red-400/70 font-mono-num ml-auto">{duplicates.length} 条</div>
          </div>
          <div className="space-y-3">
            {duplicates.map((c) => (
              <DuplicateBlock key={c.id} c={c} getVisaLine={getVisaLine} getCollisionById={getCollisionById} />
            ))}
          </div>
        </section>
      )}

      <section className="rounded-lg border border-ink-800 bg-ink-900/60 overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-ink-800 flex items-center gap-2">
          <Ruler className="w-4 h-4 text-amber-400" />
          <div className="text-sm font-semibold text-ink-100">拖偏预审来源（签证单行级追溯）</div>
          <div className="text-[11px] text-ink-500 font-mono-num ml-auto">{biasRelated.length} 条</div>
        </div>
        <div className="divide-y divide-ink-800/60">
          {biasRelated.map((c) => {
            const visa = getVisaLine(c.visaLineId);
            const boundary = getBoundaryByCollision(c.id);
            return (
              <div key={c.id} className="px-4 py-3 grid grid-cols-12 gap-3 items-center">
                <div className="col-span-2">
                  <div className="font-mono-num text-xs text-ink-200">{c.pointCode}</div>
                  <div className="text-[11px] text-ink-500 mt-0.5">{c.building} · {c.floor}层</div>
                </div>
                <div className="col-span-3">
                  <div className="text-[11px] text-ink-500">签证单行</div>
                  <div className="text-xs text-ink-200 mt-0.5">
                    <Link to={`/visa/${visa?.visaNo}`} className="text-amber-400 hover:text-amber-300 hover:underline font-mono-num">
                      {visa?.visaNo} · L{visa?.lineNo}
                    </Link>
                    <span className="text-ink-500 mx-1">·</span>
                    <span className={`font-mono-num ${(visa?.offsetMm ?? 0) > 10 ? "text-red-400" : "text-amber-300"}`}>
                      +{visa?.offsetMm}mm
                    </span>
                  </div>
                  <div className="text-[11px] text-ink-400 mt-0.5 truncate">{visa?.content}</div>
                </div>
                <div className="col-span-3">
                  <div className="text-[11px] text-ink-500">边界样本</div>
                  {boundary ? (
                    <div className="mt-0.5">
                      <div className="text-xs text-ink-200 font-mono-num">{boundary.code}</div>
                      <div className="text-[11px] text-ink-400 mt-0.5">
                        阈值 ±{boundary.thresholdMm}mm · 实测 <span className="text-red-400 font-mono-num">+{boundary.measuredMm}mm</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-ink-600 mt-0.5">无关联样本</div>
                  )}
                </div>
                <div className="col-span-2">
                  <StatusBadge status={c.status} isDuplicate={c.isDuplicate} />
                </div>
                <div className="col-span-2 text-right">
                  <Link to="/" className="text-[11px] text-amber-400 hover:text-amber-300 hover:underline inline-flex items-center gap-1">
                    预审面板
                    <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            );
          })}
          {biasRelated.length === 0 && (
            <div className="px-4 py-10 text-center text-xs text-ink-500">当前筛选下无拖偏来源记录</div>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-ink-800 bg-ink-900/60 overflow-hidden">
        <div className="px-4 py-3 border-b border-ink-800 flex items-center gap-2">
          <FileWarning className="w-4 h-4 text-amber-400" />
          <div className="text-sm font-semibold text-ink-100">碰撞点明细与材料关联</div>
          <div className="text-[11px] text-ink-500 font-mono-num ml-auto">{list.length} 条</div>
        </div>
        <div className="divide-y divide-ink-800/60">
          {list.map((c) => (
            <ReportRow
              key={c.id}
              c={c}
              getVisaLine={getVisaLine}
              getBoundaryByCollision={getBoundaryByCollision}
              getSupplementsByCollision={getSupplementsByCollision}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function ReportStat({ label, value, accent, Icon, sub }: { label: string; value: number; accent: string; Icon: any; sub?: string }) {
  return (
    <div className="rounded-lg border border-ink-800 bg-ink-900/60 px-4 py-3">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: `${accent}18` }}>
          <Icon className="w-3.5 h-3.5" style={{ color: accent }} />
        </div>
        <div className="text-[11px] uppercase tracking-wider text-ink-500">{label}</div>
      </div>
      <div className="mt-2 text-2xl font-mono-num font-semibold" style={{ color: accent }}>{value}</div>
      {sub && <div className="text-[10px] text-ink-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function DuplicateBlock({
  c,
  getVisaLine,
  getCollisionById,
}: {
  c: Collision;
  getVisaLine: (id: string) => any;
  getCollisionById: (id: string) => any;
}) {
  const visa = getVisaLine(c.visaLineId);
  return (
    <div className="rounded-md border border-red-500/25 bg-red-500/[0.03] p-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-md bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
          <XCircle className="w-5 h-5 text-red-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono-num text-xs text-ink-100">{c.pointCode}</span>
            <StatusBadge status={c.status} isDuplicate />
            <span className="text-[11px] text-ink-500">·</span>
            <span className="text-[11px] text-red-300 font-mono-num">重复×{c.duplicateCount}</span>
          </div>
          <div className="text-[11px] text-ink-400 mt-1">{c.description}</div>
          <div className="mt-2 rounded-md bg-ink-950/60 border border-red-500/20 px-3 py-2">
            <div className="text-[11px] font-medium text-red-300 flex items-center gap-1.5">
              <AlertOctagon className="w-3 h-3" /> 异常原因
            </div>
            <div className="text-[12px] text-red-200/90 mt-0.5">{c.duplicateReason}</div>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
            <div>
              <span className="text-ink-500">关联签证：</span>
              <Link to={`/visa/${visa?.visaNo}`} className="text-amber-400 hover:text-amber-300 hover:underline font-mono-num">
                {visa?.visaNo} · L{visa?.lineNo}
              </Link>
            </div>
            <div>
              <span className="text-ink-500">截图视角：</span>
              <span className="text-ink-300">{c.screenshot.viewpoint}</span>
            </div>
            <div>
              <span className="text-ink-500">BIM坐标：</span>
              <span className="text-ink-300 font-mono-num">{c.screenshot.coords}</span>
            </div>
          </div>
          {c.relatedDuplicateIds && c.relatedDuplicateIds.length > 0 && (
            <div className="mt-2 text-[11px] text-ink-400 flex items-center gap-1.5">
              <span>关联重复记录：</span>
              {c.relatedDuplicateIds.map((rid) => {
                const r = getCollisionById(rid);
                if (!r) return null;
                const rv = getVisaLine(r.visaLineId);
                return (
                  <span key={rid} className="inline-flex items-center gap-1 rounded bg-ink-800 px-1.5 py-0.5 border border-ink-700 font-mono-num">
                    {r.pointCode}
                    <span className="text-ink-500">→</span>
                    {rv?.visaNo}·L{rv?.lineNo}
                    <span className="text-ink-500">({statusLabel[r.status]})</span>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReportRow({
  c,
  getVisaLine,
  getBoundaryByCollision,
  getSupplementsByCollision,
}: {
  c: Collision;
  getVisaLine: (id: string) => any;
  getBoundaryByCollision: (id: string) => any;
  getSupplementsByCollision: (id: string) => any;
}) {
  const visa = getVisaLine(c.visaLineId);
  const boundary = getBoundaryByCollision(c.id);
  const supplements = getSupplementsByCollision(c.id);
  const Icon = c.status === "confirmed" ? CheckCircle2 : c.status === "pending" ? Clock : XCircle;
  const accent = c.status === "confirmed" ? "#10b981" : c.status === "pending" ? "#f59e0b" : "#ef4444";

  return (
    <div className="px-4 py-4">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-md flex items-center justify-center shrink-0" style={{ background: `${accent}15` }}>
          <Icon className="w-5 h-5" style={{ color: accent }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono-num text-xs text-ink-100">{c.pointCode}</span>
            <StatusBadge status={c.status} isDuplicate={c.isDuplicate} />
            {c.isDuplicate && (
              <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 bg-red-500/15 text-red-400 border border-red-500/30 text-[10px] font-medium">
                <AlertOctagon className="w-3 h-3" /> 重复×{c.duplicateCount} · 不视为通过
              </span>
            )}
            <span className="text-[11px] text-ink-500">·</span>
            <span className="text-[11px] text-ink-400">{c.building} · {c.floor}层 · {c.reviewDate}</span>
          </div>
          <div className="text-xs text-ink-300 mt-1">{c.description}</div>

          <div className="mt-3 grid grid-cols-3 gap-3">
            <MaterialCard
              title="现场签证单"
              kind="签证"
              icon={<FileText className="w-3.5 h-3.5" />}
              accent="#f59e0b"
            >
              {visa ? (
                <div>
                  <Link to={`/visa/${visa.visaNo}`} className="font-mono-num text-amber-400 hover:text-amber-300 hover:underline text-[12px]">
                    {visa.visaNo} · 第{visa.lineNo}行
                  </Link>
                  <div className="text-[11px] text-ink-400 mt-0.5">{visa.content}</div>
                  <div className={`text-[11px] mt-1 font-mono-num ${visa.causesBias ? "text-red-400" : "text-ink-400"}`}>
                    偏移 {visa.offsetMm > 0 ? `+${visa.offsetMm}` : visa.offsetMm}mm
                    {visa.causesBias && " · 拖偏预审来源"}
                  </div>
                </div>
              ) : (
                <span className="text-[11px] text-ink-600">无</span>
              )}
            </MaterialCard>

            <MaterialCard
              title="边界样本"
              kind="偏差阈值对照"
              icon={<Ruler className="w-3.5 h-3.5" />}
              accent="#a78bfa"
            >
              {boundary ? (
                <div>
                  <div className="font-mono-num text-[12px] text-ink-100">{boundary.code}</div>
                  <div className="text-[11px] text-ink-400 mt-0.5">{boundary.description}</div>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px]">
                    <span className="text-ink-500">阈值±{boundary.thresholdMm}mm</span>
                    <span className="text-ink-600">→</span>
                    <span className="font-mono-num text-red-400">实测+{boundary.measuredMm}mm</span>
                  </div>
                  <div className="text-[11px] text-amber-300/90 mt-0.5">{boundary.remark}</div>
                </div>
              ) : (
                <span className="text-[11px] text-ink-600">该碰撞点未超出边界阈值</span>
              )}
            </MaterialCard>

            <MaterialCard
              title="后补说明"
              kind="Supplement"
              icon={<FilePlus2 className="w-3.5 h-3.5" />}
              accent="#22d3ee"
            >
              {supplements.length > 0 ? (
                <div className="space-y-2">
                  {supplements.map((s: any) => (
                    <div key={s.id}>
                      <div className="text-[12px] text-ink-200">{s.title}</div>
                      <div className="text-[11px] text-ink-400 mt-0.5">{s.content}</div>
                      <div className="text-[10px] text-ink-500 mt-0.5 font-mono-num">{s.date} · {s.author}</div>
                    </div>
                  ))}
                </div>
              ) : c.status === "pending" ? (
                <span className="text-[11px] text-amber-400/80 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> 待补交材料
                </span>
              ) : (
                <span className="text-[11px] text-ink-600">无后补说明</span>
              )}
            </MaterialCard>
          </div>

          <div className="mt-3 flex items-center gap-4 text-[11px] text-ink-400">
            <span className="flex items-center gap-1.5">
              <Eye className="w-3 h-3 text-ink-500" /> 截图视角：{c.screenshot.viewpoint}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3 h-3 text-ink-500" /> 坐标：<span className="font-mono-num">{c.screenshot.coords}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <ImageIcon className="w-3 h-3 text-ink-500" /> 现场说明：{c.screenshot.note}
            </span>
          </div>

          {c.isDuplicate && c.duplicateReason && (
            <div className="mt-3 rounded-md border border-red-500/25 bg-red-500/[0.04] px-3 py-2">
              <div className="text-[11px] font-medium text-red-300 flex items-center gap-1.5">
                <AlertOctagon className="w-3 h-3" /> 异常原因（不因状态变更而消除）
              </div>
              <div className="text-[12px] text-red-200/90 mt-0.5">{c.duplicateReason}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MaterialCard({
  title,
  kind,
  icon,
  accent,
  children,
}: {
  title: string;
  kind: string;
  icon: React.ReactNode;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-ink-700/60 bg-ink-850/50 p-2.5">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5" style={{ color: accent }}>
          {icon}
          <span className="text-[11px] font-medium">{title}</span>
        </div>
        <span className="text-[10px] text-ink-500 uppercase tracking-wider">{kind}</span>
      </div>
      {children}
    </div>
  );
}
