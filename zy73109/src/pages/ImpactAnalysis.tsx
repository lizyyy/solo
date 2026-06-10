import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  Home,
  ArrowLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Scale,
  Layers,
  GitBranch,
  BarChart3,
  Link2,
  AlertOctagon,
  ClipboardList,
  MessageCircle,
  Clock,
  User,
  CalendarDays,
  ScrollText,
  ArrowRight,
  TrendingDown,
} from "lucide-react";
import { useAppStore } from "@/store";
import BadgeChip from "@/components/BadgeChip";
import { getImpactChain } from "@/data/mockData";
import { SOURCE_META } from "@/types";
import type { SourceType, ImpactFactor, ConclusionStep, SimilarReference } from "@/types";
import { cn } from "@/lib/utils";

const SOURCE_BORDER_COLOR: Record<SourceType, string> = {
  normal: "border-l-blue-500",
  old_visa: "border-l-amber-500",
  verbal: "border-l-purple-500",
  anomaly: "border-l-red-500",
};

const SOURCE_ICON: Record<SourceType, React.ComponentType<{ className?: string }>> = {
  normal: ClipboardList,
  old_visa: FileText,
  verbal: MessageCircle,
  anomaly: AlertOctagon,
};

function FlowArrow() {
  return (
    <div className="flex items-center justify-center px-2 py-6">
      <svg width="80" height="48" viewBox="0 0 80 48" className="flow-arrow rounded-lg">
        <defs>
          <linearGradient id="arrowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#1e40af" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#94a3b8" stopOpacity="0.3" />
          </linearGradient>
        </defs>
        <line
          x1="4"
          y1="24"
          x2="60"
          y2="24"
          stroke="url(#arrowGrad)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <polygon
          points="60,14 76,24 60,34"
          fill="url(#arrowGrad)"
        />
      </svg>
    </div>
  );
}

function FactorRow({ factor }: { factor: ImpactFactor }) {
  const weightPct = Math.round(factor.weight * 100);
  return (
    <div className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-b-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-slate-800 truncate">{factor.name}</p>
          {factor.isExceeded && (
            <span className="inline-flex items-center text-red-600 flex-shrink-0">
              <AlertTriangle className="w-3.5 h-3.5" />
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-1.5 mt-0.5">
          <span className={cn(
            "font-mono text-sm font-semibold",
            factor.isExceeded ? "text-red-600" : "text-emerald-600"
          )}>
            {factor.value}{factor.unit}
          </span>
          <span className="text-[11px] text-slate-400">
            / 阈值 {factor.threshold}{factor.unit}
          </span>
        </div>
      </div>
      <div className="w-24 flex-shrink-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] text-slate-500">权重</span>
          <span className="text-[11px] font-mono font-medium text-slate-700">{weightPct}%</span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-blue-500"
            style={{ width: `${weightPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function RingPercent({ pct, size = 48 }: { pct: number; size?: number }) {
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  const color = pct >= 40 ? "#dc2626" : pct >= 20 ? "#d97706" : "#2563eb";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#e2e8f0"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        className="text-[11px] font-bold fill-slate-700"
      >
        {pct}%
      </text>
    </svg>
  );
}

function StepTimeline({ steps }: { steps: ConclusionStep[] }) {
  const sorted = [...steps].sort((a, b) => a.stepOrder - b.stepOrder);
  return (
    <ol className="relative border-l-2 border-slate-200 ml-3 space-y-5">
      {sorted.map((s) => (
        <li key={s.id} className="ml-6">
          <span className="absolute -left-[11px] flex items-center justify-center w-5 h-5 rounded-full bg-brand-blue text-white text-[10px] font-bold ring-4 ring-white">
            {s.stepOrder}
          </span>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-semibold text-slate-800">{s.stepName}</p>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-3">{s.description}</p>
                <div className="space-y-1.5">
                  <div className="rounded bg-slate-50 border border-slate-100 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-slate-400 mb-0.5">输入</p>
                    <p className="text-xs text-slate-500 leading-relaxed">{s.inputValue}</p>
                  </div>
                  <div className="flex justify-center">
                    <ArrowRight className="w-3 h-3 text-slate-300" />
                  </div>
                  <div className="rounded bg-blue-50 border border-blue-100 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-blue-500 mb-0.5">输出</p>
                    <p className="text-xs text-blue-800 font-semibold leading-relaxed">{s.outputValue}</p>
                  </div>
                  {s.formula && (
                    <div className="rounded bg-slate-100 px-3 py-2 border border-slate-200">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-0.5">公式 / 算法</p>
                      <code className="text-[11px] font-mono text-slate-700">{s.formula}</code>
                    </div>
                  )}
                </div>
              </div>
              <RingPercent pct={s.contributionPct} />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function SimilarCard({ item, onClick }: { item: SimilarReference; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 w-72 rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-brand-blue hover:shadow-md transition-all"
    >
      <div className="flex items-center justify-between mb-2">
        <p className="font-mono text-xs text-slate-500">{item.code}</p>
        <Link2 className="w-3.5 h-3.5 text-slate-400" />
      </div>
      <p className="text-sm font-semibold text-slate-800 mb-2 line-clamp-2">{item.title}</p>
      <p className="text-xs text-slate-600 mb-2 leading-relaxed">
        <span className="font-semibold text-slate-700">结论：</span>
        {item.conclusion}
      </p>
      <div className="rounded-md bg-amber-50 border border-amber-100 px-2.5 py-1.5">
        <p className="text-[11px] text-amber-700 leading-relaxed">
          <span className="font-semibold">差异：</span>
          {item.diff}
        </p>
      </div>
    </button>
  );
}

export default function ImpactAnalysis() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { records } = useAppStore();
  const [remarkExpanded, setRemarkExpanded] = useState(false);

  const record = records.find((r) => r.id === id);
  const chain = id ? getImpactChain(id) : null;

  if (!record || !chain) {
    return (
      <div className="doc-container">
        <div className="doc-card p-8">
          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            返回交底清单
          </button>
          <div className="h-96 flex items-center justify-center text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
            <div className="text-center">
              <Home className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium text-slate-700 mb-1">未找到该记录的影响分析</p>
              <p className="text-sm text-slate-500">请从交底清单首页点击"看影响链路"按钮</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const sourceMeta = SOURCE_META[record.source];
  const SourceIcon = SOURCE_ICON[record.source];
  const exceededFactors = chain.factors.filter((f) => f.isExceeded).length;
  const isQualified = exceededFactors === 0;
  const totalContribution = chain.factors.reduce((sum, f) => sum + (f.isExceeded ? Math.round(f.weight * 100) : 0), 0);
  const totalPct = Math.min(totalContribution, 100);

  const handleSimilarClick = (code: string) => {
    const target = records.find((r) => r.code === code);
    if (target) {
      navigate(`/analysis/${target.id}`);
    }
  };

  return (
    <div className="doc-container space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1.5 text-sm text-slate-500">
          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-1 hover:text-slate-800 transition-colors"
          >
            <Home className="w-3.5 h-3.5" />
            首页
          </button>
          <ChevronRight className="w-3 h-3 text-slate-300" />
          <button
            onClick={() => navigate("/impact")}
            className="hover:text-slate-800 transition-colors"
          >
            影响链路分析
          </button>
          <ChevronRight className="w-3 h-3 text-slate-300" />
          <span className="font-mono text-slate-700 font-medium">{record.code}</span>
        </div>
        <button
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回列表
        </button>
      </div>

      <div className={cn(
        "doc-card p-6 border-l-4",
        SOURCE_BORDER_COLOR[record.source]
      )}>
        <div className="flex flex-col lg:flex-row lg:items-start gap-5">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="font-mono text-sm text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                {record.code}
              </span>
              <BadgeChip type="source" value={record.source} />
              <BadgeChip type="status" value={record.status} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 leading-tight mb-2">
              {record.title}
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed mb-3">{record.content}</p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
              {record.buildingInfo && (
                <span className="inline-flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5" />
                  楼栋：{record.buildingInfo}
                </span>
              )}
              {record.floorRange && (
                <span className="inline-flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5" />
                  楼层：{record.floorRange}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="w-3.5 h-3.5" />
                {record.createdAt}
              </span>
              <span className="inline-flex items-center gap-1">
                <User className="w-3.5 h-3.5" />
                创建人：{record.createdBy}
              </span>
            </div>
            {record.remark && (
              <div className="mt-4 rounded-lg bg-slate-50 border border-slate-100 p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1.5">
                  <ScrollText className="w-3.5 h-3.5" />
                  备注说明
                </div>
                <p className={cn(
                  "text-xs text-slate-600 leading-relaxed",
                  !remarkExpanded && record.remark.length > 120 && "line-clamp-2"
                )}>
                  {record.remark}
                </p>
                {record.remark.length > 120 && (
                  <button
                    onClick={() => setRemarkExpanded(!remarkExpanded)}
                    className="text-xs text-brand-blue hover:underline mt-1"
                  >
                    {remarkExpanded ? "收起" : "展开全文"}
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 lg:flex lg:flex-col gap-3 lg:w-60 flex-shrink-0">
            <div className="rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 p-4">
              <p className="text-xs text-blue-600 mb-1">影响因子</p>
              <p className="font-serif text-2xl font-bold text-blue-900">{chain.factors.length}</p>
              <p className="text-[11px] text-blue-600/80 mt-0.5">其中 {exceededFactors} 项超阈值</p>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 p-4">
              <p className="text-xs text-amber-700 mb-1">推理步骤</p>
              <p className="font-serif text-2xl font-bold text-amber-900">{chain.steps.length}</p>
              <p className="text-[11px] text-amber-700/80 mt-0.5">步推理链路</p>
            </div>
          </div>
        </div>
      </div>

      <div className="doc-card">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-brand-blue" />
          <h2 className="text-lg font-semibold text-slate-800">影响链路分析</h2>
        </div>
        <div className="p-6">
          <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-1">
            <div className={cn(
              "flex-1 rounded-xl border-l-4 border border-slate-200 p-5 min-w-0",
              SOURCE_BORDER_COLOR[record.source],
              sourceMeta.bgColor
            )}>
              <div className="flex items-center gap-2 mb-3">
                <div className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center",
                  sourceMeta.bgColor,
                  "border",
                  sourceMeta.borderColor
                )}>
                  <SourceIcon className={cn("w-4 h-4", sourceMeta.color)} />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">① 原始记录</p>
                  <p className={cn("text-xs font-semibold", sourceMeta.color)}>{sourceMeta.label}</p>
                </div>
              </div>
              <p className="font-mono text-xs text-slate-500 mb-1.5">{record.code}</p>
              <p className="text-sm font-semibold text-slate-800 leading-tight mb-2 line-clamp-2">{record.title}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                {record.buildingInfo && <span>{record.buildingInfo}</span>}
                {record.floorRange && <span>· {record.floorRange}</span>}
              </div>
            </div>

            <FlowArrow />

            <div className="flex-1 rounded-xl border border-slate-200 bg-white p-5 min-w-0 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">② 影响因子分解</p>
                  <p className="text-xs font-semibold text-indigo-700">共 {chain.factors.length} 项 · 超阈值 {exceededFactors} 项</p>
                </div>
              </div>
              <div className="space-y-0.5">
                {chain.factors.map((f) => (
                  <FactorRow key={f.id} factor={f} />
                ))}
              </div>
            </div>

            <FlowArrow />

            <div className={cn(
              "flex-1 rounded-xl border p-5 min-w-0",
              isQualified
                ? "bg-emerald-50 border-emerald-200"
                : "bg-red-50 border-red-200"
            )}>
              <div className="flex items-center gap-2 mb-3">
                <div className={cn(
                  "w-7 h-7 rounded-lg border flex items-center justify-center",
                  isQualified
                    ? "bg-emerald-100 border-emerald-200"
                    : "bg-red-100 border-red-200"
                )}>
                  {isQualified ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <AlertOctagon className="w-4 h-4 text-red-600" />
                  )}
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">③ 最终结论</p>
                  <p className={cn(
                    "text-xs font-semibold",
                    isQualified ? "text-emerald-700" : "text-red-700"
                  )}>
                    {isQualified ? "达标 / 正常" : "不达标 / 异常"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-shrink-0">
                  <div className={cn(
                    "w-20 h-20 rounded-2xl flex flex-col items-center justify-center border-2",
                    isQualified
                      ? "bg-white border-emerald-300"
                      : "bg-white border-red-300"
                  )}>
                    <span className={cn(
                      "font-serif text-3xl font-bold leading-none",
                      isQualified ? "text-emerald-600" : "text-red-600"
                    )}>
                      {isQualified ? "✓" : `${totalPct}`}
                    </span>
                    {!isQualified && <span className="text-[10px] text-red-500 mt-0.5">贡献%</span>}
                  </div>
                </div>
                <p className={cn(
                  "text-xs font-semibold leading-relaxed flex-1",
                  isQualified ? "text-emerald-800" : "text-red-800"
                )}>
                  {chain.finalConclusion}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="doc-card">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <Scale className="w-5 h-5 text-brand-blue" />
          <h2 className="text-lg font-semibold text-slate-800">为什么影响</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-brand-blue" />
                <p className="text-sm font-semibold text-slate-800">影响解释</p>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-slate-50 to-blue-50/40 border border-slate-200 p-4">
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                  {chain.explanation}
                </p>
              </div>
            </div>
            <div className="lg:col-span-3">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-4 h-4 text-brand-blue" />
                <p className="text-sm font-semibold text-slate-800">数值对比表</p>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="doc-table">
                  <thead>
                    <tr>
                      <th className="w-[28%]">对比项</th>
                      <th className="w-[22%]">当前值</th>
                      <th className="w-[22%]">标准值</th>
                      <th className="w-[20%]">差值</th>
                      <th className="w-[8%] text-center">超阈</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chain.comparisonTable.map((row, i) => (
                      <tr key={i} className={cn(row.exceed && "bg-red-50/80 hover:bg-red-50")}>
                        <td className="font-medium text-slate-800 text-xs">{row.label}</td>
                        <td className="font-mono text-xs text-slate-700">{row.current}</td>
                        <td className="font-mono text-xs text-slate-500">{row.standard}</td>
                        <td className={cn(
                          "font-mono text-xs font-semibold",
                          row.exceed ? "text-red-600" : "text-emerald-600"
                        )}>
                          {row.diff}
                        </td>
                        <td className="text-center">
                          {row.exceed ? (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-red-100 text-red-600">
                              <AlertTriangle className="w-3 h-3" />
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-emerald-100 text-emerald-600">
                              <CheckCircle2 className="w-3 h-3" />
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="doc-card">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-brand-blue" />
          <h2 className="text-lg font-semibold text-slate-800">推理链路时间轴</h2>
        </div>
        <div className="p-6">
          <StepTimeline steps={chain.steps} />
        </div>
      </div>

      {chain.similarReferences.length > 0 && (
        <div className="doc-card">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-brand-blue" />
              <h2 className="text-lg font-semibold text-slate-800">同类记录参照</h2>
            </div>
            <span className="text-xs text-slate-500">点击卡片可跳转查看详情</span>
          </div>
          <div className="p-6">
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
              {chain.similarReferences.map((sr, i) => (
                <SimilarCard key={i} item={sr} onClick={() => handleSimilarClick(sr.code)} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
