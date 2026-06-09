import { useMemo, useState } from "react";
import {
  ScrollText,
  Search,
  ChevronDown,
  ChevronUp,
  GitCompare,
} from "lucide-react";
import { useReconcileStore } from "@/store/useReconcileStore";
import {
  LOG_ACTION_LABEL,
  type OperationLog,
  type LogAction,
} from "@/types";
import { deepDiff } from "@/utils/diff";
import DiffViewer from "@/components/DiffViewer";

type Filter = "ALL" | LogAction;

const FILTER_OPTIONS: { k: Filter; label: string }[] = [
  { k: "ALL", label: "全部变动" },
  { k: "CONFIRM", label: "确认" },
  { k: "WITHDRAW", label: "撤回" },
  { k: "BIND_ALIAS", label: "别名绑定" },
  { k: "RESOLVE_ANOMALY", label: "异常处理" },
  { k: "IMPORT_CSV", label: "CSV导入" },
  { k: "IMPORT_MEDICAL", label: "病历录入" },
];

export default function OperationLogPage() {
  const { operationLogs, schedules, pets, aliases, dataSources, medicalRecords } =
    useReconcileStore();
  const [kw, setKw] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);

  const getLabel = (log: OperationLog): string => {
    switch (log.targetType) {
      case "SCHEDULE": {
        const s = schedules.find((x) => x.id === log.targetId);
        return s ? `排程「${s.petName}·${s.courseName}」` : `排程 #${log.targetId.slice(-5)}`;
      }
      case "PET": {
        const p = pets.find((x) => x.id === log.targetId);
        return p ? `宠物「${p.canonicalName}」` : `宠物 #${log.targetId.slice(-5)}`;
      }
      case "ALIAS": {
        const a = aliases.find((x) => x.id === log.targetId);
        return a
          ? `别名「${a.aliasName}」`
          : (log.afterState?.aliasName as string) || `别名 #${log.targetId.slice(-5)}`;
      }
      case "SOURCE": {
        const s = dataSources.find((x) => x.id === log.targetId);
        return s ? `来源「${s.fileName}」` : `来源 #${log.targetId.slice(-5)}`;
      }
      default:
        return `#${log.targetId.slice(-5)}`;
    }
  };

  const filtered = useMemo(() => {
    return operationLogs
      .filter((l) => (filter === "ALL" ? true : l.action === filter))
      .filter((l) => {
        if (!kw.trim()) return true;
        const k = kw.trim().toLowerCase();
        return (
          LOG_ACTION_LABEL[l.action].toLowerCase().includes(k) ||
          l.operator.toLowerCase().includes(k) ||
          (l.remark || "").toLowerCase().includes(k) ||
          getLabel(l).toLowerCase().includes(k)
        );
      });
  }, [operationLogs, filter, kw, schedules, pets, aliases, dataSources]);

  const compareLog = compareId ? operationLogs.find((l) => l.id === compareId) : null;

  return (
    <div className="space-y-5">
      <section className="card p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-100 text-brand-700 flex items-center justify-center">
            <ScrollText className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h2 className="font-serif text-xl font-semibold text-warm-800">
              变动操作日志
            </h2>
            <p className="text-sm text-warm-500 mt-1">
              社区公示前在这里复盘。每条记录都留了「变动前 / 变动后」的并排对比，
              <b className="text-warm-700">让接手同事能看到人工确认前后到底改了什么</b>。
            </p>
          </div>
          <div className="text-right">
            <div className="font-serif text-3xl font-bold text-brand-700">
              {operationLogs.length}
            </div>
            <div className="text-[11px] text-warm-500">累计操作</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-warm-400" />
            <input
              value={kw}
              onChange={(e) => setKw(e.target.value)}
              placeholder="搜索操作人 / 备注 / 目标"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-warm-200 text-sm focus:outline-none focus:border-brand-500"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FILTER_OPTIONS.map((t) => (
              <button
                key={t.k}
                onClick={() => setFilter(t.k)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filter === t.k
                    ? "bg-brand-600 text-white"
                    : "bg-warm-100 text-warm-600 hover:bg-warm-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-warm-500">
            还没有操作记录。去「排程明细」点一下确认，日志就会出现啦。
          </div>
        ) : (
          <div className="relative">
            <div className="absolute left-[74px] top-0 bottom-0 w-0.5 bg-warm-200" />
            <div className="divide-y divide-warm-100">
              {filtered.map((log, idx) => {
                const date = log.operatedAt.slice(0, 10);
                const time = log.operatedAt.slice(11, 16);
                const prev = filtered[idx + 1];
                const showDateHeader = !prev || prev.operatedAt.slice(0, 10) !== date;
                const expanded = expandedId === log.id;
                return (
                  <div key={log.id}>
                    {showDateHeader && (
                      <div className="px-5 py-2 bg-warm-50 sticky top-0 z-10">
                        <span className="inline-flex items-center gap-2 text-xs font-semibold text-warm-600">
                          📅 {date}
                        </span>
                      </div>
                    )}
                    <div className="relative pl-[44px] pr-5 py-4 hover:bg-warm-50/60">
                      <div className="absolute left-[64px] top-6 w-5 h-5 rounded-full bg-white border-[3px] border-brand-500 z-[1]" />
                      <div className="ml-10 flex flex-wrap items-center gap-2">
                        <span className="text-[11px] text-warm-500 w-12 shrink-0">
                          {time}
                        </span>
                        <ActionTag action={log.action} />
                        <span className="text-sm text-warm-800 font-medium">
                          {getLabel(log)}
                        </span>
                        <span className="text-xs text-warm-500">·</span>
                        <span className="text-xs text-warm-600">{log.operator}</span>
                        {log.remark && (
                          <span className="text-xs text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full max-w-md truncate">
                            {log.remark}
                          </span>
                        )}
                        <div className="ml-auto flex items-center gap-2">
                          {log.beforeState && log.afterState && (
                            <button
                              className="btn-secondary !py-1 !px-2.5 text-xs"
                              onClick={() =>
                                setCompareId(compareId === log.id ? null : log.id)
                              }
                            >
                              <GitCompare className="w-3.5 h-3.5" />
                              {compareId === log.id ? "收起对比" : "公示复盘对比"}
                            </button>
                          )}
                          <button
                            onClick={() => setExpanded(expanded ? null : log.id)}
                            className="w-7 h-7 rounded-lg hover:bg-warm-100 flex items-center justify-center text-warm-500"
                          >
                            {expanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {expanded && (
                        <div className="ml-10 mt-3 animate-fadeUp">
                          {log.beforeState && log.afterState ? (
                            <DiffViewer
                              chunks={deepDiff(log.beforeState, log.afterState)}
                            />
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                              <div className="rounded-lg bg-warm-50 p-3">
                                <div className="text-[11px] text-warm-500 mb-1">
                                  变动前
                                </div>
                                <pre className="whitespace-pre-wrap break-all text-warm-700">
                                  {JSON.stringify(log.beforeState, null, 2) || "（无）"}
                                </pre>
                              </div>
                              <div className="rounded-lg bg-success-50 p-3">
                                <div className="text-[11px] text-success-700 mb-1">
                                  变动后
                                </div>
                                <pre className="whitespace-pre-wrap break-all text-warm-700">
                                  {JSON.stringify(log.afterState, null, 2) || "（无）"}
                                </pre>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {compareId === log.id && log.beforeState && log.afterState && (
                        <div className="ml-10 mt-4 animate-fadeUp">
                          <div className="rounded-xl border-2 border-brand-500/20 bg-gradient-to-br from-brand-50/60 to-white p-4">
                            <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-brand-700">
                              <GitCompare className="w-4 h-4" />
                              社区公示用 · 并排对比：确认前 vs 确认后
                            </div>
                            <div className="grid grid-cols-[90px_1fr_1fr] gap-3 text-xs font-semibold pb-2 border-b border-dashed border-brand-300/60 text-warm-500">
                              <div>字段</div>
                              <div className="text-danger-700">📕 确认前</div>
                              <div className="text-success-700">📗 确认后</div>
                            </div>
                            <DiffViewer
                              chunks={deepDiff(log.beforeState, log.afterState)}
                            />
                            <div className="mt-3 pt-3 border-t border-dashed border-brand-300/60 grid grid-cols-3 gap-2 text-[11px] text-warm-500">
                              <div>
                                <b>操作人：</b>
                                {log.operator}
                              </div>
                              <div>
                                <b>时间：</b>
                                {log.operatedAt.replace("T", " ").slice(0, 19)}
                              </div>
                              <div>
                                <b>备注：</b>
                                {log.remark || "—"}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function ActionTag({ action }: { action: LogAction }) {
  const map: Record<LogAction, string> = {
    CONFIRM: "tag-confirmed",
    WITHDRAW: "tag-withdrawn",
    BIND_ALIAS: "tag-pending",
    RESOLVE_ANOMALY: "tag-anomaly",
    IMPORT_CSV: "tag-pending",
    IMPORT_MEDICAL: "tag-pending",
  };
  return <span className={map[action]}>{LOG_ACTION_LABEL[action]}</span>;
}
