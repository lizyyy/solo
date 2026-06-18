import { useState } from "react";
import { TrendingUp, AlertTriangle, Clock, CheckCircle2, AlertOctagon, Gauge, Copy, Check, ChevronRight, Download } from "lucide-react";
import { useStore } from "@/store";
import { cn } from "@/lib/utils";
import { StatusBadge, AnomalyBadge } from "@/components/Badges";
import type { ProjectSummary } from "@/types";

export function ProjectSummaryView() {
  const { projectSummary, selectRecord, jumpToIndex, getFilteredRecords, refreshSummary } = useStore();
  const [copied, setCopied] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const summary = projectSummary;

  const handleCopyJson = () => {
    const jsonOutput = formatSummary(summary);
    navigator.clipboard.writeText(jsonOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadJson = () => {
    const jsonOutput = formatSummary(summary);
    const blob = new Blob([jsonOutput], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `deep-sea-sampling-report-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSelectRecord = (recordId: string) => {
    const records = getFilteredRecords();
    const idx = records.findIndex(r => r.id === recordId);
    if (idx >= 0) {
      jumpToIndex(idx);
      selectRecord(recordId);
    }
  };

  const progressPercent = Math.round(
    (summary.statusBreakdown.resolved / summary.totalRecords) * 100
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            深海采样项目汇报
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            数据更新时间: {new Date(summary.lastUpdated).toLocaleString("zh-CN")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowJson(!showJson)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              showJson
                ? "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            )}
          >
            {showJson ? "查看可视化" : "查看接口返回"}
          </button>
          <button
            onClick={handleCopyJson}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2 transition-colors"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? "已复制" : "复制JSON"}
          </button>
          <button
            onClick={handleDownloadJson}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 flex items-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4" />
            下载报告
          </button>
          <button
            onClick={refreshSummary}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
          >
            刷新
          </button>
        </div>
      </div>

      {showJson ? (
        <div className="bg-slate-900 rounded-xl p-6 overflow-auto max-h-[70vh]">
          <pre className="text-emerald-400 text-sm font-mono whitespace-pre-wrap">
            {formatSummary(summary)}
          </pre>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-slate-500">总记录数</div>
                  <div className="text-3xl font-bold text-slate-800 mt-1">{summary.totalRecords}</div>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span>整体完成进度</span>
                  <span className="font-semibold text-slate-700">{progressPercent}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-slate-500">异常记录</div>
                  <div className="text-3xl font-bold text-red-500 mt-1">{summary.anomalyCount}</div>
                </div>
                <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                  <AlertOctagon className="w-6 h-6 text-red-600" />
                </div>
              </div>
              <div className="mt-3 text-xs text-slate-500">
                <span className="text-emerald-600 font-medium">
                  {summary.anomalyBreakdown.value_exceeded}
                </span>
                <span className="text-slate-400"> 数值超限 · </span>
                <span className="text-orange-600 font-medium">
                  {summary.anomalyBreakdown.sensor_drift}
                </span>
                <span className="text-slate-400"> 传感器漂移</span>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-slate-500">待补证据</div>
                  <div className="text-3xl font-bold text-amber-500 mt-1">
                    {summary.statusBreakdown.pending_evidence}
                  </div>
                </div>
                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                  <Clock className="w-6 h-6 text-amber-600" />
                </div>
              </div>
              <div className="mt-3 text-xs text-amber-600">
                需要实验室分析报告和现场照片
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-slate-500">还卡着</div>
                  <div className="text-3xl font-bold text-rose-500 mt-1">
                    {summary.statusBreakdown.blocked}
                  </div>
                </div>
                <div className="w-12 h-12 bg-rose-100 rounded-xl flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-rose-600" />
                </div>
              </div>
              <div className="mt-3 text-xs text-rose-600">
                {summary.driftSummary.filter(d => !d.corrected).length} 个传感器待校准
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                状态分布
              </h3>
              <div className="space-y-3">
                {[
                  { label: "已处理", value: summary.statusBreakdown.resolved, color: "bg-emerald-500", status: "resolved" as const },
                  { label: "待补证据", value: summary.statusBreakdown.pending_evidence, color: "bg-amber-500", status: "pending_evidence" as const },
                  { label: "还卡着", value: summary.statusBreakdown.blocked, color: "bg-rose-500", status: "blocked" as const },
                ].map(item => (
                  <div key={item.status}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", item.color)} />
                        <span className="text-sm text-slate-600">{item.label}</span>
                      </div>
                      <span className="text-sm font-medium text-slate-800">{item.value} 条</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full", item.color)}
                        style={{ width: `${(item.value / summary.totalRecords) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 text-red-500" />
                异常类型分布
              </h3>
              <div className="space-y-3">
                {Object.entries(summary.anomalyBreakdown).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AnomalyBadge type={type as any} />
                    </div>
                    <span className="text-sm font-medium text-slate-800">{count} 条</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {summary.pendingEvidenceList.length > 0 && (
            <div className="bg-white rounded-xl border border-amber-200 p-5">
              <h3 className="text-sm font-semibold text-amber-800 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              待补证据清单
            </h3>
              <div className="space-y-2">
                {summary.pendingEvidenceList.map(item => (
                  <div
                    key={item.recordId}
                    onClick={() => handleSelectRecord(item.recordId)}
                    className="bg-amber-50 rounded-lg p-4 border border-amber-100 cursor-pointer hover:bg-amber-100 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-mono text-sm text-amber-800">{item.recordId}</div>
                        <div className="text-xs text-amber-600 mt-0.5">
                          {new Date(item.timestamp).toLocaleString("zh-CN")} · 深度 {item.position.depth}m
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {item.missingEvidence.map(ev => (
                        <span key={ev} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                          缺少: {ev}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {summary.blockedList.length > 0 && (
            <div className="bg-white rounded-xl border border-rose-200 p-5">
              <h3 className="text-sm font-semibold text-rose-800 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                阻塞问题清单
              </h3>
              <div className="space-y-2">
                {summary.blockedList.map(item => (
                  <div
                    key={item.recordId}
                    onClick={() => handleSelectRecord(item.recordId)}
                    className="bg-rose-50 rounded-lg p-4 border border-rose-100 cursor-pointer hover:bg-rose-100 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-mono text-sm text-rose-800">{item.recordId}</div>
                        <div className="text-xs text-rose-600 mt-0.5">
                          {new Date(item.timestamp).toLocaleString("zh-CN")} · 深度 {item.position.depth}m
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-rose-400" />
                    </div>
                    <div className="mt-2 text-sm text-rose-700 bg-rose-100 px-3 py-2 rounded">
                      阻塞原因: {item.blockReason}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Gauge className="w-4 h-4 text-orange-500" />
              传感器漂移汇总
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-100">
                    <th className="pb-3 font-medium">漂移ID</th>
                    <th className="pb-3 font-medium">传感器</th>
                    <th className="pb-3 font-medium">偏移量</th>
                    <th className="pb-3 font-medium">影响记录数</th>
                    <th className="pb-3 font-medium">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.driftSummary.map(drift => (
                    <tr key={drift.driftId} className="border-b border-slate-50">
                      <td className="py-3 font-mono text-slate-600">{drift.driftId}</td>
                      <td className="py-3 font-mono text-slate-800">{drift.sensorId}</td>
                      <td className={cn("py-3 font-medium", drift.driftValue > 0 ? "text-red-600" : "text-blue-600")}>
                        {drift.driftValue > 0 ? "+" : ""}{drift.driftValue}
                      </td>
                      <td className="py-3 text-slate-600">{drift.affectedCount} 条</td>
                      <td className="py-3">
                        {drift.corrected ? (
                          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded">
                            已校准
                          </span>
                        ) : (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded">
                            待校准
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function formatSummary(summary: ProjectSummary): string {
  return JSON.stringify({
    project: "深海采样时序回放",
    reportGeneratedAt: new Date().toISOString(),
    overview: {
      totalRecords: summary.totalRecords,
      anomalyCount: summary.anomalyCount,
      withdrawnCount: summary.withdrawnCount,
      driftAffectedCount: summary.driftAffectedCount,
      completionRate: `${Math.round((summary.statusBreakdown.resolved / summary.totalRecords) * 100)}%`,
      status: {
        resolved: summary.statusBreakdown.resolved,
        pending_evidence: summary.statusBreakdown.pending_evidence,
        blocked: summary.statusBreakdown.blocked,
      },
      anomalyTypes: summary.anomalyBreakdown,
    },
    pendingActionItems: [
      ...summary.pendingEvidenceList.map(item => ({
        type: "pending_evidence",
        recordId: item.recordId,
        timestamp: item.timestamp,
        position: item.position,
        missingEvidence: item.missingEvidence,
        action: "补充证据材料",
      })),
      ...summary.blockedList.map(item => ({
        type: "blocked",
        recordId: item.recordId,
        timestamp: item.timestamp,
        position: item.position,
        blockReason: item.blockReason,
        action: "解决阻塞问题",
      })),
    ],
    sensorDrifts: summary.driftSummary.map(d => ({
      driftId: d.driftId,
      sensorId: d.sensorId,
      driftValue: d.driftValue,
      affectedRecords: d.affectedCount,
      corrected: d.corrected,
      actionRequired: !d.corrected,
    })),
    recommendations: [
      summary.statusBreakdown.pending_evidence > 0 && {
        priority: "high",
        action: "优先补充待补证据清单中的实验室分析报告和现场照片",
        affectedRecords: summary.statusBreakdown.pending_evidence,
      },
      summary.driftSummary.some(d => !d.corrected) && {
        priority: "high",
        action: "尽快校准未完成校准的传感器",
        sensorIds: summary.driftSummary.filter(d => !d.corrected).map(d => d.sensorId),
      },
      summary.statusBreakdown.blocked > 0 && {
        priority: "critical",
        action: "立即处理阻塞问题，确保数据完整性",
        affectedRecords: summary.statusBreakdown.blocked,
      },
    ].filter(Boolean),
    lastUpdated: summary.lastUpdated,
  }, null, 2);
}
