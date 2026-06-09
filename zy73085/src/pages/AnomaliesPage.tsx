import { useState } from "react";
import { useAnomaliesStore } from "@/stores/useAnomaliesStore";
import { useModelStore } from "@/stores/useModelStore";
import { useMinutesStore } from "@/stores/useMinutesStore";
import {
  AlertTriangle,
  Filter,
  Search,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  History,
  MessageSquare,
  Send,
  RefreshCw,
  Clock,
  ArrowRight,
  Scale,
} from "lucide-react";
import { StatusBadge, SeverityBadge, HoldBadge } from "@/components/StatusBadges";
import { useUIGlobalStore } from "@/stores/useUIGlobalStore";
import { AnomalyStatus } from "@/types";

export default function AnomaliesPage() {
  const {
    anomalies,
    expandedId,
    toggleExpand,
    filterSeverity,
    filterStatus,
    setFilterSeverity,
    setFilterStatus,
    updateStatus,
    updateConclusion,
    addNote,
    runRecheck,
    getSnapshotsFor,
    getNotesFor,
  } = useAnomaliesStore();
  const { annotations } = useModelStore();
  const { minutes } = useMinutesStore();
  const { showToast } = useUIGlobalStore();

  const [query, setQuery] = useState("");
  const [author, setAuthor] = useState("算法值班-当前");
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});

  const annById = Object.fromEntries(annotations.map((a) => [a.id, a]));
  const minById = Object.fromEntries(minutes.map((m) => [m.id, m]));

  const filtered = anomalies
    .filter((a) => (filterSeverity === "all" ? true : a.severity === filterSeverity))
    .filter((a) => (filterStatus === "all" ? true : a.status === filterStatus))
    .filter((a) => {
      if (!query) return true;
      const q = query.toLowerCase();
      const ann = annById[a.annotationId];
      return (
        a.title.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        (ann?.locationCode || "").toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const sevOrder = { critical: 0, warning: 1, info: 2 } as const;
      const d = sevOrder[a.severity] - sevOrder[b.severity];
      if (d !== 0) return d;
      return b.createdAt.localeCompare(a.createdAt);
    });

  const criticalCount = anomalies.filter((a) => a.severity === "critical").length;
  const openCount = anomalies.filter((a) => ["open", "processing"].includes(a.status)).length;

  const handleAddNote = (anomalyId: string) => {
    const content = noteInputs[anomalyId];
    if (!content?.trim()) return;
    addNote(anomalyId, `【重跑保护】${content.trim()}`, author);
    setNoteInputs({ ...noteInputs, [anomalyId]: "" });
    showToast("success", "备注已保存（重跑不会覆盖）");
  };

  return (
    <div className="space-y-6">
      <div className="eng-card p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-ink-900 flex items-center gap-2 mb-1">
            <AlertTriangle size={18} className="text-warn-600" />
            异常队列追溯
          </h2>
          <p className="text-xs text-ink-500">
            展开可查看 <b className="text-brand-700">时间胶囊（结论变化轨迹）</b> +{" "}
            <b className="text-warn-700">受保护备注（重跑不覆盖）</b>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-eng bg-danger-50 text-danger-700 border border-danger-200 text-xs font-bold">
            <AlertTriangle size={12} /> 严重 {criticalCount}
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-eng bg-warn-50 text-warn-700 border border-warn-200 text-xs font-bold">
            <Clock size={12} /> 待处理 {openCount}
          </span>
          <button
            onClick={() => {
              const r = runRecheck(author);
              showToast(
                "success",
                `重新复核完成 · ${r.runId} · 旧异常 ${r.anomaliesCountBefore} → 合并后 ${r.anomaliesCountAfter}`
              );
            }}
            className="eng-btn-primary"
          >
            <RefreshCw size={14} />
            重新复核（保留历史）
          </button>
        </div>
      </div>

      {/* 筛选栏 */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[280px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            className="eng-input pl-9"
            placeholder="搜索标题 / 位置编码 / 异常ID"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1 border border-ink-200 rounded-eng overflow-hidden bg-white">
          <Filter size={13} className="text-ink-500 mx-2" />
          <div className="text-[11px] text-ink-500 px-1 border-r border-ink-200 py-1">严重度</div>
          {(["all", "critical", "warning", "info"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterSeverity(s)}
              className={`px-2.5 py-2 text-xs font-medium transition-colors ${
                filterSeverity === s
                  ? "bg-brand-600 text-white"
                  : "text-ink-600 hover:bg-ink-50"
              }`}
            >
              {s === "all" ? "全部" : s === "critical" ? "严重" : s === "warning" ? "警告" : "提示"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 border border-ink-200 rounded-eng overflow-hidden bg-white">
          <div className="text-[11px] text-ink-500 px-1 border-r border-ink-200 py-1">状态</div>
          {(["all", "open", "processing", "suspended", "resolved", "released"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-2.5 py-2 text-xs font-medium transition-colors ${
                filterStatus === s
                  ? "bg-brand-600 text-white"
                  : "text-ink-600 hover:bg-ink-50"
              }`}
            >
              {s === "all"
                ? "全部"
                : s === "open"
                ? "待复核"
                : s === "processing"
                ? "复核中"
                : s === "suspended"
                ? "挂起"
                : s === "resolved"
                ? "解决"
                : "放行"}
            </button>
          ))}
        </div>
      </div>

      {/* 异常队列 */}
      <div className="space-y-3">
        {filtered.map((a) => {
          const ann = annById[a.annotationId];
          const mins = ann?.minutesId ? minById[ann.minutesId] : null;
          const snaps = getSnapshotsFor(a.id);
          const notes = getNotesFor(a.id);
          const expanded = expandedId === a.id;

          return (
            <div
              key={a.id}
              className={`eng-card overflow-hidden transition-all ${
                expanded ? "ring-2 ring-brand-500/60" : ""
              }`}
            >
              {/* 异常主行 */}
              <div
                className="p-4 cursor-pointer hover:bg-brand-50/20 transition-colors"
                onClick={() => toggleExpand(a.id)}
              >
                <div className="flex items-start gap-4">
                  <button
                    className={`mt-1 w-6 h-6 rounded-eng flex items-center justify-center text-ink-400 hover:bg-ink-100 shrink-0 ${
                      expanded ? "bg-brand-50 text-brand-700" : ""
                    }`}
                  >
                    {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <SeverityBadge severity={a.severity} />
                      <StatusBadge status={a.status} />
                      <HoldBadge decision={a.holdDecision} />
                      {a.isRerunGenerated && (
                        <span className="eng-tag bg-brand-100 text-brand-700 border border-brand-200 text-[10px]">
                          <RefreshCw size={9} /> 重跑生成
                        </span>
                      )}
                      {snaps.length > 0 && (
                        <span className="eng-tag bg-warn-50 text-warn-700 border border-warn-200 text-[10px]">
                          <History size={9} /> {snaps.length} 次变更
                        </span>
                      )}
                      {notes.length > 0 && (
                        <span className="eng-tag bg-yellow-50 text-yellow-800 border border-yellow-200 text-[10px]">
                          📝 {notes.length} 条备注
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-black text-ink-900 mb-0.5">{a.title}</h4>
                    <p className="text-xs text-ink-600 leading-relaxed">{a.description}</p>

                    {(a.conclusionBefore || a.conclusionAfter) && (
                      <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-eng bg-gradient-to-r from-warn-50 to-brand-50 border border-warn-200 text-[11px]">
                        <span className="text-warn-700 font-medium">{a.conclusionBefore || "初始状态"}</span>
                        <ArrowRight size={12} className="text-ink-400" />
                        <span className="text-brand-700 font-bold">{a.conclusionAfter || "—"}</span>
                        <span className="text-ink-400 ml-2">本次结论变化</span>
                      </div>
                    )}
                  </div>

                  <div className="text-right shrink-0 max-w-[180px]">
                    <div className="text-[11px] font-mono text-ink-400 mb-1">{a.id}</div>
                    {ann && (
                      <>
                        <div className="text-xs font-bold text-brand-700 font-mono">
                          {ann.locationCode}
                        </div>
                        <div className="text-[11px] text-ink-500 truncate">
                          {ann.floor} · {ann.area}
                        </div>
                      </>
                    )}
                    {mins && (
                      <div className="text-[10px] text-ink-500 mt-1 truncate" title={mins.source}>
                        📎 {mins.source.slice(0, 24)}…
                      </div>
                    )}
                    <div className="text-[10px] text-ink-400 font-mono mt-1">
                      {new Date(a.createdAt).toLocaleString("zh-CN", {
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* 展开详情 */}
              {expanded && (
                <div className="border-t border-ink-200 bg-ink-50/40 p-5 space-y-5">
                  {/* 决策与理由 */}
                  {a.holdReason && (
                    <div className="p-4 rounded-eng bg-white border border-ink-200 shadow-eng">
                      <h5 className="text-xs font-bold text-ink-700 mb-2 flex items-center gap-2">
                        <Scale size={13} className="text-warn-600" />
                        挂起 / 放行 · 决策理由
                      </h5>
                      <p className="text-sm text-ink-800 bg-gradient-to-r from-warn-50 to-white p-3 rounded-eng border border-warn-100">
                        💡 {a.holdReason}
                      </p>
                    </div>
                  )}

                  {/* 结论追溯时间线 */}
                  <div>
                    <h5 className="text-xs font-bold text-ink-700 mb-3 flex items-center gap-2">
                      <History size={13} className="text-brand-600" />
                      结论变化追溯 · 时间胶囊
                      {snaps.length === 0 && <span className="font-normal text-ink-400 ml-1">（暂无记录）</span>}
                    </h5>
                    {snaps.length > 0 && (
                      <ol className="relative ml-3 border-l-2 border-brand-200 space-y-3 pl-5">
                        {snaps.map((s) => (
                          <li key={s.id} className="relative">
                            <span
                              className={`absolute -left-[30px] top-1 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-eng ${
                                s.fieldName === "status"
                                  ? "bg-brand-600"
                                  : s.fieldName === "conclusion"
                                  ? "bg-warn-600"
                                  : "bg-ink-500"
                              }`}
                            >
                              ●
                            </span>
                            <div className="eng-card p-3 bg-white">
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                <span className="text-[10px] font-mono text-ink-400">
                                  {new Date(s.createdAt).toLocaleString("zh-CN")}
                                </span>
                                <span className="eng-tag bg-brand-50 text-brand-700 border border-brand-200 text-[10px]">
                                  字段：{s.fieldName}
                                </span>
                                <span className="text-[10px] text-ink-500 ml-auto">操作人：{s.operator}</span>
                              </div>
                              <div className="flex items-center gap-3 text-sm mb-2">
                                <span className="flex-1 px-3 py-1.5 rounded-eng bg-ink-100 text-ink-600 font-mono text-xs min-h-[32px] flex items-center">
                                  {s.oldValue || "空"}
                                </span>
                                <ArrowRight size={14} className="text-brand-500 shrink-0" />
                                <span className="flex-1 px-3 py-1.5 rounded-eng bg-brand-50 text-brand-800 font-mono text-xs font-bold min-h-[32px] flex items-center">
                                  {s.newValue || "空"}
                                </span>
                              </div>
                              {s.note && (
                                <div className="text-xs text-ink-600 bg-warn-50 p-2 rounded-eng border border-warn-100">
                                  📌 {s.note}
                                </div>
                              )}
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>

                  {/* 操作栏（状态 + 结论快速操作） */}
                  <div className="p-4 rounded-eng bg-white border border-ink-200">
                    <h5 className="text-xs font-bold text-ink-700 mb-3 flex items-center gap-2">
                      <ShieldCheck size={13} className="text-safe-600" />
                      快速处理操作
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[11px] text-ink-500 mb-1 font-bold">
                          状态切换
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {(["open", "processing", "suspended", "resolved", "released"] as AnomalyStatus[]).map(
                            (st) => (
                              <button
                                key={st}
                                onClick={() => {
                                  updateStatus(a.id, st, author, "快速操作");
                                  showToast("success", "状态已更新");
                                }}
                                className={`!py-1 !px-2 text-[11px] eng-btn ${
                                  a.status === st ? "!bg-brand-600 !text-white !border-brand-700" : ""
                                }`}
                              >
                                <StatusBadge status={st} size="xs" />
                              </button>
                            )
                          )}
                        </div>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[11px] text-ink-500 mb-1 font-bold">
                          更新复核结论
                        </label>
                        <div className="flex gap-2">
                          <input
                            className="eng-input"
                            placeholder="输入新的复核结论..."
                            defaultValue={a.conclusionAfter || ""}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                updateConclusion(a.id, (e.target as HTMLInputElement).value, author, "快速更新");
                                showToast("success", "结论已更新，快照已生成");
                              }
                            }}
                            onBlur={(e) => {
                              if (e.target.value !== a.conclusionAfter) {
                                updateConclusion(a.id, e.target.value, author, "快速更新");
                                showToast("success", "结论已更新，快照已生成");
                              }
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 备注 */}
                  <div>
                    <h5 className="text-xs font-bold text-ink-700 mb-3 flex items-center gap-2">
                      <MessageSquare size={13} className="text-yellow-700" />
                      历史备注
                      <span className="eng-tag bg-yellow-100 text-yellow-800 border border-yellow-300 text-[10px] font-normal">
                        🔒 受保护 · 重跑不覆盖
                      </span>
                    </h5>
                    <div className="space-y-2 mb-3">
                      {notes.length === 0 ? (
                        <div className="text-xs text-ink-400 py-2 bg-yellow-50/50 border border-yellow-100 rounded-eng text-center">
                          暂无备注，添加的备注永久保留，重新复核不会被覆盖
                        </div>
                      ) : (
                        notes.map((n) => (
                          <div
                            key={n.id}
                            className="p-3 rounded-eng bg-yellow-50 border-l-4 border-yellow-500 shadow-eng"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-bold text-yellow-900">
                                {n.author}
                                {n.isProtected && (
                                  <span className="ml-2 text-[10px] text-yellow-700 bg-yellow-200/60 px-1.5 rounded">
                                    🔒 已保护
                                  </span>
                                )}
                              </span>
                              <span className="text-[10px] font-mono text-yellow-700">
                                {new Date(n.createdAt).toLocaleString("zh-CN")}
                              </span>
                            </div>
                            <div className="text-sm text-yellow-950 whitespace-pre-wrap leading-relaxed">
                              {n.content}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        className="eng-input !py-1.5 text-xs"
                        placeholder="输入备注内容（回车或失焦保存）"
                        value={noteInputs[a.id] || ""}
                        onChange={(e) => setNoteInputs({ ...noteInputs, [a.id]: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddNote(a.id);
                        }}
                      />
                      <select
                        className="eng-input !py-1.5 text-xs w-[150px]"
                        value={author}
                        onChange={(e) => setAuthor(e.target.value)}
                      >
                        <option>算法值班-当前</option>
                        <option>施工经理-阿乔</option>
                        <option>项目总工-刘</option>
                        <option>监理-赵</option>
                      </select>
                      <button
                        onClick={() => handleAddNote(a.id)}
                        className="eng-btn-primary !py-1.5 text-xs"
                      >
                        <Send size={12} /> 保存备注
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="eng-card p-16 text-center text-ink-400">
            <AlertTriangle size={40} className="mx-auto mb-3 opacity-40" />
            <div>没有匹配的异常记录</div>
          </div>
        )}
      </div>
    </div>
  );
}
