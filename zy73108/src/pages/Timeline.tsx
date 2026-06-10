import { useMemo, useState } from "react";
import {
  Download,
  Link as LinkIcon,
  FileJson,
  FileSpreadsheet,
  History,
  Hash,
  User,
  Clock4,
  CheckCircle2,
  Undo2,
  AlertOctagon,
  MessageSquare,
  GitBranchPlus,
  Sparkles,
  X,
} from "lucide-react";
import { FilterBar } from "@/components/FilterBar";
import { useMaterialStore } from "@/store/materialStore";
import { formatDate } from "@/utils/validators";
import {
  buildTimelineRows,
  downloadBlob,
  exportTimelineCsv,
  exportTimelineJson,
  parseFilterFromUrl,
} from "@/utils/exporter";
import type { ChangeLog, FilterOptions, LogAction } from "@/types";

const ACTION_META: Record<
  LogAction,
  { label: string; cls: string; icon: any; dot: string }
> = {
  import: {
    label: "导入",
    cls: "chip-ink",
    icon: Hash,
    dot: "!bg-ink-400",
  },
  supplement: {
    label: "后补版本",
    cls: "chip-ink",
    icon: GitBranchPlus,
    dot: "!bg-ink-600",
  },
  confirm: {
    label: "确认",
    cls: "chip-moss",
    icon: CheckCircle2,
    dot: "!bg-moss-500",
  },
  revoke: {
    label: "撤回",
    cls: "chip-ember",
    icon: Undo2,
    dot: "!bg-ember-500",
  },
  remark: {
    label: "修改备注",
    cls: "chip-neutral",
    icon: MessageSquare,
    dot: "!bg-ink-300",
  },
  mark_late: {
    label: "标记晚到",
    cls: "chip-ember",
    icon: AlertOctagon,
    dot: "!bg-ember-400",
  },
  unmark_late: {
    label: "取消晚到标记",
    cls: "chip-moss",
    icon: AlertOctagon,
    dot: "!bg-moss-400",
  },
  update: {
    label: "更新",
    cls: "chip-neutral",
    icon: Sparkles,
    dot: "!bg-ink-400",
  },
};

const ACTION_FILTER_OPTIONS: { value: LogAction | "all"; label: string }[] = [
  { value: "all", label: "全部操作" },
  { value: "import", label: "导入" },
  { value: "supplement", label: "后补版本" },
  { value: "confirm", label: "确认" },
  { value: "revoke", label: "撤回" },
  { value: "remark", label: "修改备注" },
  { value: "mark_late", label: "标记晚到" },
  { value: "unmark_late", label: "取消晚到标记" },
  { value: "update", label: "更新" },
];

export const Timeline = () => {
  const records = useMaterialStore((s) => s.records);
  const logs = useMaterialStore((s) => s.logs);
  const listBatchNos = useMaterialStore((s) => s.listBatchNos);
  const listOperators = useMaterialStore((s) => s.listOperators);
  const getRecordById = useMaterialStore((s) => s.getRecordById);

  const initial = parseFilterFromUrl();
  const [filter, setFilter] = useState<FilterOptions>({
    isLateChange: "all",
    status: "all",
    ...initial,
  });
  const [showActionFilter, setShowActionFilter] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const batches = listBatchNos();
  const operators = listOperators();

  const filteredLogs = useMemo(
    () =>
      logs
        .filter((log) => {
          if (
            filter.action &&
            filter.action !== "all" &&
            log.action !== filter.action
          ) {
            return false;
          }
          if (filter.batchNo && filter.batchNo.trim()) {
            if (!log.batchNo.includes(filter.batchNo.trim())) return false;
          }
          if (filter.operator && filter.operator.trim()) {
            if (!log.operator.includes(filter.operator.trim())) return false;
          }
          if (filter.materialNo && filter.materialNo.trim()) {
            const mno =
              log.materialNo ||
              getRecordById(log.recordId)?.materialNo ||
              "";
            if (!mno.includes(filter.materialNo.trim())) return false;
          }
          if (filter.keyword && filter.keyword.trim()) {
            const kw = filter.keyword.trim().toLowerCase();
            const r = getRecordById(log.recordId);
            const hay = [
              log.detail,
              log.operator,
              log.batchNo,
              log.materialNo,
              log.title,
              r?.title,
              r?.remark,
              r?.content,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();
            if (!hay.includes(kw)) return false;
          }
          if (filter.dateFrom) {
            if (log.timestamp < filter.dateFrom + "T00:00:00") return false;
          }
          if (filter.dateTo) {
            if (log.timestamp > filter.dateTo + "T23:59:59") return false;
          }
          return true;
        })
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    [logs, filter, getRecordById]
  );

  const timelineRows = useMemo(
    () => buildTimelineRows(filteredLogs, records, filter),
    [filteredLogs, records, filter]
  );

  const grouped = useMemo(() => {
    const groups: Record<string, ChangeLog[]> = {};
    filteredLogs.forEach((log) => {
      const key = formatDate(log.timestamp).slice(0, 10);
      if (!groups[key]) groups[key] = [];
      groups[key].push(log);
    });
    return Object.entries(groups).sort((a, b) =>
      b[0].localeCompare(a[0])
    );
  }, [filteredLogs]);

  const doExport = (format: "json" | "csv") => {
    const rows = timelineRows;
    const blob =
      format === "json"
        ? exportTimelineJson(rows)
        : exportTimelineCsv(rows);
    const stamp = new Date().toISOString().slice(0, 10);
    const name = `日照体量方案比选-时间线-${stamp}.${format}`;
    downloadBlob(blob, name);
    showToast(`已导出 ${rows.length} 条记录为 ${format.toUpperCase()}`);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const copyBatchToClipboard = async (batchNo: string) => {
    const rows = timelineRows.filter((r) => r.batchNo === batchNo);
    const text = rows
      .map((r) => `[${r.timestamp}] ${r.action} · ${r.operator} · ${r.materialNo} ${r.title} — ${r.detail}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      showToast(`批次 ${batchNo}（${rows.length} 条）已复制到剪贴板`);
    } catch {
      showToast("复制失败");
    }
  };

  const logAction = (log: ChangeLog) => ACTION_META[log.action] || ACTION_META.update;

  return (
    <div className="container max-w-[1200px] px-6 py-6 space-y-5">
      {toast && (
        <div className="fixed top-20 right-6 z-50 card px-4 py-2.5 text-sm border-ink-200 bg-white shadow-cardHover animate-slideIn flex items-center gap-2">
          <Sparkles size={14} className="text-ink-500" />
          {toast}
          <button
            onClick={() => setToast(null)}
            className="ml-2 text-ink-400 hover:text-ink"
          >
            <X size={13} />
          </button>
        </div>
      )}

      <header className="flex items-start justify-between animate-fadeIn">
        <div>
          <h2 className="font-serif font-semibold text-ink text-xl flex items-center gap-2">
            <History size={20} className="text-ink-500" />
            历史时间线
          </h2>
          <p className="text-sm text-ink-500 mt-1">
            导入、确认、撤回、备注、晚到标记等全部操作按时间可追溯，按筛选可导出追回同批记录
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => doExport("json")}
            className="btn-secondary"
            title="导出 JSON（完整结构）"
          >
            <FileJson size={15} /> 导出 JSON
          </button>
          <button
            onClick={() => doExport("csv")}
            className="btn-primary"
            title="导出 CSV（Excel 兼容）"
          >
            <FileSpreadsheet size={15} /> 导出 CSV
          </button>
        </div>
      </header>

      <FilterBar
        filter={filter}
        onChange={setFilter}
        batchNos={batches}
        operators={operators}
        showLateToggle={false}
        showStatus={false}
      />

      {showActionFilter && (
        <div className="card px-4 py-2.5 flex items-center gap-2 flex-wrap animate-slideIn">
          <span className="text-xs text-ink-500 mr-1">操作类型</span>
          {ACTION_FILTER_OPTIONS.map((opt) => {
            const active = (filter.action || "all") === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() =>
                  setFilter({
                    ...filter,
                    action: opt.value === "all" ? undefined : opt.value,
                  })
                }
                className={`chip transition-all ${
                  active
                    ? "!bg-ink !text-white !border-ink"
                    : "chip-neutral hover:!border-ink-200"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
          <div className="ml-auto flex items-center gap-2">
            <span className="chip-neutral !text-[11px]">
              共 {filteredLogs.length} 条日志
            </span>
            {filter.batchNo && (
              <button
                onClick={() => copyBatchToClipboard(filter.batchNo!)}
                className="btn-ghost !text-xs !py-1"
              >
                <LinkIcon size={12} /> 复制当前批次文本
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_260px] gap-5">
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-paper-line bg-white/70 flex items-center justify-between sticky top-0 z-10">
            <p className="text-sm font-semibold text-ink">
              操作时序（
              {filteredLogs.length} 条）
            </p>
            {filter.batchNo && (
              <span className="stamp-moss font-mono !text-[10px]">
                批次筛选：{filter.batchNo}
              </span>
            )}
          </div>
          <div className="p-5 max-h-[calc(100vh-260px)] overflow-y-auto">
            {grouped.length === 0 ? (
              <div className="py-16 text-center text-ink-400 text-sm">
                <History size={28} className="mx-auto mb-2 opacity-40" />
                暂无匹配的历史记录
              </div>
            ) : (
              <div className="space-y-6">
                {grouped.map(([dateKey, dayLogs]) => (
                  <div key={dateKey} className="relative">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="inline-block px-2.5 py-1 bg-ink text-white text-[11px] font-mono rounded">
                        {dateKey}
                      </span>
                      <span className="text-xs text-ink-400">
                        {dayLogs.length} 条操作
                      </span>
                      <div className="flex-1 h-px bg-gradient-to-r from-paper-line to-transparent" />
                    </div>
                    <div className="relative pl-6 border-l border-paper-line space-y-4">
                      {dayLogs.map((log) => {
                        const meta = logAction(log);
                        const Icon = meta.icon;
                        const rec = getRecordById(log.recordId);
                        return (
                          <div
                            key={log.id}
                            className="relative animate-slideIn"
                          >
                            <span
                              className={`timeline-dot ${meta.dot}`}
                              title={meta.label}
                            />
                            <div className="card-interactive p-3.5 ml-2">
                              <div className="flex items-start gap-3">
                                <div
                                  className={`${meta.cls} !px-2 !py-1 flex items-center gap-1 !text-[11px] flex-shrink-0`}
                                >
                                  <Icon size={11} /> {meta.label}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <span className="text-[11px] text-ink-500 font-mono inline-flex items-center gap-1">
                                      <Clock4 size={10} />
                                      {formatDate(log.timestamp).slice(11)}
                                    </span>
                                    <span className="text-[11px] text-ink-500 inline-flex items-center gap-1">
                                      <User size={10} /> {log.operator}
                                    </span>
                                    <span
                                      className="text-[11px] font-mono text-ink-600 inline-flex items-center gap-1 hover:underline cursor-pointer"
                                      onClick={() =>
                                        setFilter({
                                          ...filter,
                                          batchNo: log.batchNo,
                                        })
                                      }
                                      title="点击按批次号筛选"
                                    >
                                      <Hash size={10} className="text-ink-400" />
                                      {log.batchNo}
                                    </span>
                                    {rec && rec.version > 1 && (
                                      <span className="chip-neutral !py-0 !text-[10px]">
                                        <GitBranchPlus size={10} /> v
                                        {rec.version}
                                      </span>
                                    )}
                                    {rec && rec.isLateChange && (
                                      <span className="chip-ember !py-0 !text-[10px]">
                                        <AlertOctagon size={10} /> 晚到
                                      </span>
                                    )}
                                  </div>
                                  <p className="font-serif font-semibold text-sm text-ink leading-snug">
                                    {log.title || rec?.title || "(记录标题)"}
                                  </p>
                                  {log.materialNo && (
                                    <p className="text-[11px] text-ink-500 font-mono mt-0.5">
                                      {log.materialNo}
                                    </p>
                                  )}
                                  <p className="text-xs text-ink-700 leading-relaxed mt-2 bg-paper border border-paper-line rounded px-2.5 py-1.5">
                                    {log.detail}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="card p-4 animate-slideIn">
            <p className="text-xs text-ink-500 mb-2.5">快捷追回 · 批次号清单</p>
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {batches.length === 0 ? (
                <p className="text-xs text-ink-400 py-4 text-center">
                  暂无批次
                </p>
              ) : (
                batches.map((b) => {
                  const count = logs.filter((l) => l.batchNo === b).length;
                  const active = filter.batchNo === b;
                  return (
                    <button
                      key={b}
                      onClick={() =>
                        setFilter({
                          ...filter,
                          batchNo: active ? undefined : b,
                        })
                      }
                      className={`w-full text-left rounded px-2.5 py-2 text-xs transition-colors flex items-center justify-between gap-2 ${
                        active
                          ? "bg-ink text-white"
                          : "bg-paper hover:bg-ink-50 text-ink-700"
                      }`}
                    >
                      <span className="font-mono truncate">{b}</span>
                      <span
                        className={`flex-shrink-0 ${
                          active ? "text-white/80" : "text-ink-400"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="card p-4 animate-slideIn">
            <p className="text-xs text-ink-500 mb-2.5">当前筛选条件</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(filter)
                .filter(([k, v]) => {
                  if (k === "isLateChange") return false;
                  if (k === "status") return false;
                  return v !== undefined && String(v).trim() !== "";
                })
                .map(([k, v]) => (
                  <span
                    key={k}
                    className="chip-ink !text-[10px] inline-flex items-center gap-1"
                  >
                    {k}:{String(v).slice(0, 20)}
                    <button
                      onClick={() =>
                        setFilter({
                          ...filter,
                          [k]: undefined,
                        })
                      }
                      className="ml-1 opacity-70 hover:opacity-100"
                    >
                      <X size={9} />
                    </button>
                  </span>
                ))}
              {Object.entries(filter).filter(([k, v]) => {
                if (k === "isLateChange") return false;
                if (k === "status") return false;
                return v !== undefined && String(v).trim() !== "";
              }).length === 0 && (
                <span className="text-xs text-ink-400">无筛选</span>
              )}
            </div>
          </div>

          <div className="card p-4 border-moss-200 bg-moss-50/60 animate-slideIn">
            <p className="text-xs text-moss-700 mb-1.5 font-semibold flex items-center gap-1">
              <Download size={12} /> 复核人操作指引
            </p>
            <ol className="text-[11px] text-moss-800 space-y-1 leading-relaxed list-decimal list-inside">
              <li>点击左侧批次号 → 一键追回同批全部记录</li>
              <li>叠加关键词 / 日期 / 操作人组合筛选</li>
              <li>顶部按钮导出 JSON 或 CSV 给下一环</li>
              <li>晚到变更单通过"标记晚到"单独拎出</li>
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
};
