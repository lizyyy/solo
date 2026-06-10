import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ClipboardList,
  AlertOctagon,
  FileText,
  MessageCircle,
  Clock,
  RefreshCw,
  Database,
  Search,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Info,
} from "lucide-react";
import BadgeChip from "@/components/BadgeChip";
import { useAppStore } from "@/store";
import { SOURCE_META, STATUS_META } from "@/types";
import { cn } from "@/lib/utils";

const SOURCE_BORDER_COLOR: Record<string, string> = {
  normal: "border-l-blue-500",
  anomaly: "border-l-red-500",
  old_visa: "border-l-amber-500",
  verbal: "border-l-purple-500",
};

export default function Home() {
  const navigate = useNavigate();
  const {
    records,
    batch,
    isDirtyDataLoaded,
    selectedSourceFilter,
    selectedStatusFilter,
    searchKeyword,
    toggleSourceFilter,
    toggleStatusFilter,
    setSearchKeyword,
    setSourceFilter,
    setStatusFilter,
    loadDirtyDemoData,
    getFilteredRecords,
    getStats,
  } = useAppStore();

  const [isLoading, setIsLoading] = useState(false);
  const [showNotice, setShowNotice] = useState(false);

  const stats = getStats();
  const filteredRecords = getFilteredRecords();
  const total = stats.total || 1;

  const handleLoadDemoData = () => {
    setIsLoading(true);
    setShowNotice(false);
    setTimeout(() => {
      loadDirtyDemoData();
      setIsLoading(false);
      setShowNotice(true);
      setTimeout(() => setShowNotice(false), 6000);
    }, 2000);
  };

  const handleReRunAnalysis = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
    }, 1200);
  };

  const pct = (n: number) => `${((n / total) * 100).toFixed(0)}%`;

  const statCards = [
    {
      label: "正常记录",
      value: stats.normal,
      icon: ClipboardList,
      bgGradient: "from-blue-500 to-blue-600",
      badgeBg: "bg-blue-50",
      badgeText: "text-blue-700",
      borderColor: "border-blue-100",
      pct: pct(stats.normal),
    },
    {
      label: "异常数据",
      value: stats.anomaly,
      icon: AlertTriangle,
      bgGradient: "from-orange-500 to-red-500",
      badgeBg: "bg-orange-50",
      badgeText: "text-orange-700",
      borderColor: "border-orange-100",
      pct: pct(stats.anomaly),
    },
    {
      label: "旧版签证单",
      value: stats.oldVisa,
      icon: FileText,
      bgGradient: "from-amber-500 to-yellow-600",
      badgeBg: "bg-amber-50",
      badgeText: "text-amber-700",
      borderColor: "border-amber-100",
      pct: pct(stats.oldVisa),
    },
    {
      label: "待补证据",
      value: stats.pending,
      icon: MessageCircle,
      bgGradient: "from-yellow-500 to-lime-500",
      badgeBg: "bg-yellow-50",
      badgeText: "text-yellow-700",
      borderColor: "border-yellow-100",
      pct: pct(stats.pending),
    },
  ];

  const sourceList = Object.entries(SOURCE_META) as [keyof typeof SOURCE_META, typeof SOURCE_META[keyof typeof SOURCE_META]][];
  const statusList = Object.entries(STATUS_META) as [keyof typeof STATUS_META, typeof STATUS_META[keyof typeof STATUS_META]][];

  return (
    <div className="doc-container space-y-6">
      {showNotice && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3.5 shadow-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-sm text-emerald-800">
            <span className="font-semibold">已加载不太干净的演示数据：</span>
            包含正常记录 + 模型坐标偏移 + 旧版签证单 + 口头备注等 8 条混合数据
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:items-start gap-6 lg:gap-8">
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className={cn(
                  "relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm transition-transform hover:-translate-y-0.5",
                  card.borderColor
                )}
              >
                <div
                  className={cn(
                    "absolute top-0 right-0 w-24 h-24 rounded-full opacity-10 -translate-y-8 translate-x-8 bg-gradient-to-br",
                    card.bgGradient
                  )}
                />
                <div className="relative">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-500">{card.label}</p>
                    <div
                      className={cn(
                        "w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-inner",
                        card.bgGradient
                      )}
                    >
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <p className="mt-3 font-serif text-3xl font-bold text-slate-900 leading-none">
                    {card.value}
                  </p>
                  <div className={cn("mt-3 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium", card.badgeBg, card.badgeText)}>
                    占比 {card.pct}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center gap-3 lg:gap-4 lg:w-60">
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 w-full sm:w-auto">
            <Clock className="w-3.5 h-3.5" />
            <span>最后运行：{batch.lastRunAt}</span>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto lg:flex-col">
            <button
              onClick={handleReRunAnalysis}
              disabled={isLoading || records.length === 0}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all",
                records.length === 0
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                  : "bg-brand-blue text-white hover:bg-brand-blue/90 active:scale-[0.98] shadow-sm"
              )}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              重跑分析
            </button>
            <button
              onClick={handleLoadDemoData}
              disabled={isLoading}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all",
                isDirtyDataLoaded
                  ? "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 active:scale-[0.98]"
                  : "bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 active:scale-[0.98] shadow-sm"
              )}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Database className="w-4 h-4" />
              )}
              {isDirtyDataLoaded ? "重新加载演示数据" : "加载脏演示数据"}
            </button>
          </div>
        </div>
      </div>

      <div className="doc-card p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">来源</span>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSourceFilter([])}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                    selectedSourceFilter.length === 0
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-900"
                  )}
                >
                  全部
                </button>
                {sourceList.map(([key, meta]) => {
                  const active = selectedSourceFilter.includes(key);
                  return (
                    <button
                      key={key}
                      onClick={() => toggleSourceFilter(key)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                        active
                          ? `${meta.bgColor} ${meta.color} ${meta.borderColor} ring-2 ring-offset-1 ring-opacity-50`
                          : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-900"
                      )}
                    >
                      <span className="text-sm leading-none">{meta.icon}</span>
                      {meta.label}
                      <span className="ml-0.5 rounded bg-white/60 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                        {stats[key === "normal" ? "normal" : key === "anomaly" ? "anomaly" : key === "old_visa" ? "oldVisa" : "verbal"]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">状态</span>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setStatusFilter([])}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                    selectedStatusFilter.length === 0
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-900"
                  )}
                >
                  全部
                </button>
                {statusList.map(([key, meta]) => {
                  const active = selectedStatusFilter.includes(key);
                  return (
                    <button
                      key={key}
                      onClick={() => toggleStatusFilter(key)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                        active
                          ? `${meta.bgColor} ${meta.color} ${meta.borderColor}`
                          : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-900"
                      )}
                    >
                      <span className={cn("w-1.5 h-1.5 rounded-full", meta.dotColor)} />
                      {meta.label}
                      <span className="ml-0.5 rounded bg-white/60 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                        {stats[key === "confirmed" ? "confirmed" : key === "pending_evidence" ? "pending" : "processing"]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="relative lg:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="搜索编号 / 关键词..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition-all"
            />
          </div>
        </div>
      </div>

      {records.length === 0 ? (
        <div className="doc-card">
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mb-6">
              <Database className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-xl font-semibold text-slate-800 mb-2">还没有数据</h3>
            <p className="text-sm text-slate-500 mb-6 max-w-md">
              点击右上角 <span className="font-semibold text-amber-600">"加载脏演示数据"</span> 按钮，
              系统将模拟算法运行并注入包含正常记录、模型坐标偏移、旧版签证单、口头备注等混合场景的 8 条演示数据。
            </p>
            <div className="flex flex-wrap justify-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1.5">
                📋 正常记录 × 3
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-red-50 text-red-700 border border-red-100 px-2.5 py-1.5">
                ⚠️ 异常数据 × 2
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 text-amber-700 border border-amber-100 px-2.5 py-1.5">
                📜 旧版签证单 × 1
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 text-purple-700 border border-purple-100 px-2.5 py-1.5">
                💬 口头备注 × 2
              </span>
            </div>
          </div>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="doc-card">
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-16 h-16 rounded-xl bg-slate-50 flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-1">没有匹配的记录</h3>
            <p className="text-sm text-slate-500">请调整筛选条件或清空搜索关键词</p>
          </div>
        </div>
      ) : (
        <div className="doc-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="doc-table">
              <thead>
                <tr>
                  <th className="w-52">编号 / 标题</th>
                  <th className="w-36">楼栋 / 楼层</th>
                  <th className="w-28">来源</th>
                  <th>影响摘要</th>
                  <th className="w-32">状态</th>
                  <th className="w-56 text-right pr-6">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => (
                  <tr
                    key={record.id}
                    className={cn("border-l-4 transition-colors", SOURCE_BORDER_COLOR[record.source])}
                  >
                    <td className="py-4">
                      <div className="flex flex-col gap-1.5">
                        <span className="font-mono text-[11px] text-slate-500 tracking-tight">
                          {record.code}
                        </span>
                        <span className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2">
                          {record.title}
                        </span>
                        {record.remark && (
                          <span className="inline-flex items-center gap-1 mt-0.5 text-[11px] text-slate-500">
                            <Info className="w-3 h-3 flex-shrink-0" />
                            <span className="line-clamp-1">{record.remark}</span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-slate-800">
                          {record.buildingInfo || "-"}
                        </span>
                        <span className="text-xs text-slate-500">
                          {record.floorRange || "-"}
                        </span>
                      </div>
                    </td>
                    <td>
                      <BadgeChip type="source" value={record.source} />
                    </td>
                    <td>
                      <p className="text-sm text-slate-600 leading-relaxed line-clamp-2">
                        {record.impactSummary || "-"}
                      </p>
                    </td>
                    <td>
                      <BadgeChip type="status" value={record.status} />
                    </td>
                    <td className="text-right pr-6">
                      <div className="flex items-center justify-end gap-2 flex-wrap">
                        <button
                          onClick={() => navigate(`/analysis/${record.id}`)}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 active:scale-[0.98] transition-all shadow-sm"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                          看影响链路
                        </button>
                        {record.source !== "anomaly" && (
                          <button
                            className="inline-flex items-center gap-1 rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-100 active:scale-[0.98] transition-all"
                          >
                            <AlertOctagon className="w-3.5 h-3.5" />
                            标记异常
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-500">
            <span>
              共 <span className="font-semibold text-slate-700">{filteredRecords.length}</span> / {records.length} 条记录
            </span>
            <span className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500" /> 正常
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500" /> 异常
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> 旧版
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-purple-500" /> 口头
              </span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
