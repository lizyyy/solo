import { useEffect, useState } from "react";
import {
  Download,
  CheckCircle,
  XCircle,
  HelpCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  FileText,
} from "lucide-react";
import { useStore } from "@/store";
import { cn } from "@/lib/utils";

const severityConfig = {
  info: { color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30", icon: FileText },
  warning: { color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", icon: AlertTriangle },
  critical: { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30", icon: XCircle },
};

export default function EvaluationPage() {
  const { evaluationReport, fetchEvaluation, filter, exportData, fetchLeakAlerts, leakAlerts } =
    useStore();
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchEvaluation();
    fetchLeakAlerts();
  }, []);

  if (!evaluationReport) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500">
        暂无评估数据
      </div>
    );
  }

  const report = evaluationReport;
  const cards = [
    { label: "总特征数", value: report.totalFeatures, icon: FileText, color: "text-zinc-400" },
    { label: "一致数", value: report.consistentCount, icon: CheckCircle, color: "text-green-400" },
    { label: "不一致数", value: report.inconsistentCount, icon: XCircle, color: "text-red-400" },
    { label: "待确认数", value: report.pendingCount, icon: HelpCircle, color: "text-amber-400" },
    { label: "泄漏告警数", value: report.leakAlertCount, icon: AlertTriangle, color: "text-red-400" },
  ];

  function toggleExpand(idx: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  const filterDesc = [];
  if (filter.featureName) filterDesc.push(`特征名称: ${filter.featureName}`);
  if (filter.status !== "all") filterDesc.push(`状态: ${filter.status}`);
  if (filter.dateFrom) filterDesc.push(`起始: ${filter.dateFrom}`);
  if (filter.dateTo) filterDesc.push(`截止: ${filter.dateTo}`);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-mono-display text-2xl font-bold text-zinc-100">
            评估说明
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            生成时间: {new Date(report.generatedAt).toLocaleString("zh-CN")}
          </p>
        </div>
        <button
          onClick={() => exportData("csv")}
          className="btn-secondary text-sm flex items-center gap-1.5"
        >
          <Download className="w-4 h-4" />
          导出报告
        </button>
      </div>

      {filterDesc.length > 0 && (
        <div className="card-dark px-4 py-3 mb-6">
          <span className="text-zinc-400 text-sm">筛选条件: </span>
          <span className="text-amber-400 text-sm font-mono-display">
            {filterDesc.join(" | ")}
          </span>
        </div>
      )}

      <div className="grid grid-cols-5 gap-4 mb-8">
        {cards.map((card) => (
          <div key={card.label} className="card-dark p-4 text-center">
            <card.icon className={cn("w-5 h-5 mx-auto mb-2", card.color)} />
            <div className={cn("text-2xl font-bold font-mono-display", card.color)}>
              {card.value}
            </div>
            <div className="text-zinc-500 text-xs mt-1">{card.label}</div>
          </div>
        ))}
      </div>

      <h2 className="font-mono-display text-lg font-semibold text-zinc-200 mb-4">
        评估结论
      </h2>

      {report.conclusions.length === 0 && (
        <div className="card-dark p-8 text-center text-zinc-500">
          当前筛选条件下无评估结论
        </div>
      )}

      <div className="space-y-3">
        {report.conclusions.map((c, idx) => {
          const sev = severityConfig[c.severity];
          const isExpanded = expanded.has(idx);
          const Icon = sev.icon;

          return (
            <div
              key={idx}
              className={cn("card-dark p-4 border-l-2", sev.border)}
            >
              <div className="flex items-start gap-3">
                <Icon className={cn("w-5 h-5 shrink-0 mt-0.5", sev.color)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono-display font-semibold text-zinc-100">
                      {c.featureName}
                    </span>
                    <span
                      className={cn("badge", sev.color, sev.bg)}
                    >
                      {c.severity === "info"
                        ? "信息"
                        : c.severity === "warning"
                        ? "警告"
                        : "严重"}
                    </span>
                  </div>
                  <p className="text-zinc-300 text-sm mt-1">{c.conclusion}</p>

                  <button
                    onClick={() => toggleExpand(idx)}
                    className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 mt-2 transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-3 h-3" />
                    ) : (
                      <ChevronRight className="w-3 h-3" />
                    )}
                    查看详情
                  </button>

                  {isExpanded && (
                    <div className="mt-2 space-y-2 pl-3 border-l border-zinc-700">
                      <div>
                        <span className="text-xs text-zinc-500 font-medium">原因: </span>
                        <span className="text-sm text-zinc-400">{c.reason}</span>
                      </div>
                      <div>
                        <span className="text-xs text-zinc-500 font-medium">下一步: </span>
                        <span className="text-sm text-amber-400">{c.nextStep}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
