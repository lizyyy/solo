import { BadgeCheck, Clock, AlertTriangle, ChevronRight } from "lucide-react";
import { useStore } from "@/store";
import { cn } from "@/lib/utils";
import { StatusBadge, AnomalyBadge } from "@/components/Badges";
import type { RecordStatus } from "@/types";

interface StatusColumnProps {
  status: RecordStatus;
  title: string;
  icon: any;
  colorClass: string;
  bgClass: string;
}

function StatusColumn({ status, title, icon: Icon, colorClass, bgClass }: StatusColumnProps) {
  const { getFilteredRecords, selectRecord, jumpToIndex, getAnomaliesForRecord } = useStore();
  const records = getFilteredRecords().filter((r) => r.status === status);

  const handleSelect = (recordId: string) => {
    const allRecords = getFilteredRecords();
    const index = allRecords.findIndex((r) => r.id === recordId);
    if (index >= 0) {
      jumpToIndex(index);
      selectRecord(recordId);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 flex flex-col">
      <div className={cn("px-4 py-3 border-b border-slate-200 rounded-t-xl flex items-center gap-2", bgClass)}>
        <Icon className={cn("w-4 h-4", colorClass)} />
        <h3 className={cn("text-sm font-semibold", colorClass)}>{title}</h3>
        <span className="ml-auto text-xs bg-white/50 px-2 py-0.5 rounded-full font-medium">
          {records.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[500px]">
        {records.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">
            暂无{title}记录
          </div>
        ) : (
          records.map((record) => {
            const anomalies = getAnomaliesForRecord(record.id);
            return (
              <div
                key={record.id}
                onClick={() => handleSelect(record.id)}
                className="bg-slate-50 rounded-lg p-3 cursor-pointer hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs text-slate-600">{record.id}</span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
                <div className="text-sm font-medium text-slate-800">
                  {new Date(record.timestamp).toLocaleTimeString("zh-CN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  深度 {record.position.depth}m · {record.position.longitude.toFixed(3)}°E
                </div>

                {anomalies.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {anomalies.slice(0, 2).map((a) => (
                      <AnomalyBadge key={a.id} type={a.type} />
                    ))}
                    {anomalies.length > 2 && (
                      <span className="text-xs text-slate-400">+{anomalies.length - 2}</span>
                    )}
                  </div>
                )}

                {record.withdrawalId && (
                  <div className="mt-2 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    已撤回 · 见第{record.notebookSource.page}页
                  </div>
                )}

                {record.driftIds.length > 0 && (
                  <div className="mt-1 text-xs text-orange-600">
                    受{record.driftIds.length}个传感器漂移影响
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export function StatusKanban() {
  const { projectSummary, refreshSummary } = useStore();

  const columns: { status: RecordStatus; title: string; icon: any; colorClass: string; bgClass: string }[] = [
    {
      status: "resolved",
      title: "已处理",
      icon: BadgeCheck,
      colorClass: "text-emerald-700",
      bgClass: "bg-emerald-50",
    },
    {
      status: "pending_evidence",
      title: "待补证据",
      icon: Clock,
      colorClass: "text-amber-700",
      bgClass: "bg-amber-50",
    },
    {
      status: "blocked",
      title: "还卡着",
      icon: AlertTriangle,
      colorClass: "text-rose-700",
      bgClass: "bg-rose-50",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">状态分类看板</h2>
          <p className="text-sm text-slate-500 mt-1">
            点击记录可跳转至对应时序位置
          </p>
        </div>
        <button
          onClick={refreshSummary}
          className="px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
        >
          刷新汇总
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="grid grid-cols-5 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-slate-800">{projectSummary.totalRecords}</div>
            <div className="text-xs text-slate-500 mt-1">总记录数</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-500">{projectSummary.anomalyCount}</div>
            <div className="text-xs text-slate-500 mt-1">异常数</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-500">{projectSummary.withdrawnCount}</div>
            <div className="text-xs text-slate-500 mt-1">已撤回</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-500">{projectSummary.driftAffectedCount}</div>
            <div className="text-xs text-slate-500 mt-1">漂移影响</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-500">
              {projectSummary.statusBreakdown.resolved}
            </div>
            <div className="text-xs text-slate-500 mt-1">已处理</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {columns.map((col) => (
          <StatusColumn key={col.status} {...col} />
        ))}
      </div>
    </div>
  );
}
