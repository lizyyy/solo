import { useState } from "react";
import { useQueueStore } from "@/store/useQueueStore";
import type { ExportFormat } from "@/types";
import { checkExportConsistency, generateExport, downloadFile } from "@/utils/exportHelpers";
import {
  Download,
  FileJson,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ExportModal({ open, onClose }: ExportModalProps) {
  const { getFilteredEvents, filter, events, statusChanges, auditLogs } =
    useQueueStore();

  const [format, setFormat] = useState<ExportFormat>("csv");
  const [includeHistory, setIncludeHistory] = useState(false);
  const [includeLogs, setIncludeLogs] = useState(false);
  const [consistencyResult, setConsistencyResult] = useState<{
    consistent: boolean;
    issues: string[];
  } | null>(null);
  const [checked, setChecked] = useState(false);

  if (!open) return null;

  const filteredEvents = getFilteredEvents();

  const handleCheck = () => {
    const result = checkExportConsistency(filteredEvents, filter, events);
    setConsistencyResult(result);
    setChecked(true);
  };

  const handleExport = () => {
    const content = generateExport(
      format,
      filteredEvents,
      statusChanges,
      auditLogs,
      includeHistory,
      includeLogs
    );

    const ext = format === "csv" ? "csv" : "json";
    const mime =
      format === "csv" ? "text/csv;charset=utf-8" : "application/json";
    const filename = `webhook-compensation-queue-${new Date().toISOString().slice(0, 10)}.${ext}`;

    downloadFile(content, filename, mime);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-zinc-200 dark:border-zinc-700">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-700 flex items-center gap-2 text-base font-semibold text-zinc-800 dark:text-zinc-200">
          <Download className="w-5 h-5 text-amber-500" />
          导出数据
        </div>

        <div className="p-6 space-y-5">
          <div>
            <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
              导出范围
            </div>
            <div className="px-3 py-2 rounded-md bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-700 dark:text-zinc-300">
              当前筛选结果共{" "}
              <span className="font-semibold">{filteredEvents.length}</span>{" "}
              条事件
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
              导出格式
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setFormat("csv")}
                className={`flex-1 px-4 py-3 rounded-lg border text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                  format === "csv"
                    ? "border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300"
                    : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600"
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                CSV
              </button>
              <button
                onClick={() => setFormat("json")}
                className={`flex-1 px-4 py-3 rounded-lg border text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                  format === "json"
                    ? "border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300"
                    : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600"
                }`}
              >
                <FileJson className="w-4 h-4" />
                JSON
              </button>
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
              附加内容
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeHistory}
                  onChange={(e) => setIncludeHistory(e.target.checked)}
                  className="rounded border-zinc-300 dark:border-zinc-600 text-amber-500 focus:ring-amber-500"
                />
                包含状态变更记录
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeLogs}
                  onChange={(e) => setIncludeLogs(e.target.checked)}
                  className="rounded border-zinc-300 dark:border-zinc-600 text-amber-500 focus:ring-amber-500"
                />
                包含审计日志
              </label>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                一致性校验
              </div>
              {!checked && (
                <button
                  onClick={handleCheck}
                  className="text-xs text-amber-600 dark:text-amber-400 hover:underline"
                >
                  执行校验
                </button>
              )}
            </div>

            {checked && consistencyResult && (
              <div
                className={`px-3 py-2 rounded-md border text-sm ${
                  consistencyResult.consistent
                    ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
                    : "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300"
                }`}
              >
                {consistencyResult.consistent ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    一致性校验通过
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 font-medium">
                      <XCircle className="w-4 h-4" />
                      一致性校验未通过
                    </div>
                    <ul className="space-y-1 ml-6">
                      {consistencyResult.issues.map((issue, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          {issue}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-700 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-md border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2 text-sm font-medium rounded-md bg-amber-500 text-white hover:bg-amber-600 transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            确认导出
          </button>
        </div>
      </div>
    </div>
  );
}
