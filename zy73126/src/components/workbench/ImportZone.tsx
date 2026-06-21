import { useRef, useState, type DragEvent } from "react";
import { Upload, FileSearch, AlertCircle, CheckCircle, X, FileText } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import type { ImportReport } from "../../store/useAppStore";
import { mockRecords } from "../../data/mockData";
import { ANOMALY_LABEL } from "../../data/types";

export default function ImportZone() {
  const [dragOver, setDragOver] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const importRecords = useAppStore((s) => s.importRecords);
  const importFromFile = useAppStore((s) => s.importFromFile);
  const rerunDetection = useAppStore((s) => s.rerunDetection);

  const processFile = async (file: File) => {
    const rep = await importFromFile(file);
    setReport(rep);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    processFile(file);
  };

  const handleClick = () => inputRef.current?.click();

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
    e.target.value = "";
  };

  const handleLoadSample = () => {
    const rep = importRecords(mockRecords);
    setReport(rep);
  };

  return (
    <div className="space-y-3">
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={[
          "flex flex-col items-center justify-center gap-3 p-10 rounded-xl transition-colors cursor-pointer",
          dragOver
            ? "border-2 border-coral-400 bg-coral-50/20"
            : "border-2 border-dashed border-deep-100 hover:border-coral-300 hover:bg-coral-50/10",
        ].join(" ")}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".json,.csv,application/json,text/csv"
          className="hidden"
          onChange={handleFileInput}
        />
        <Upload
          size={32}
          className={dragOver ? "text-coral-400" : "text-deep-200"}
        />
        <p className="text-deep-300 text-sm">
          拖拽船上记录本文件至此，或<span className="text-coral-400 font-medium mx-1">点击选择文件</span>
        </p>
        <p className="text-xs text-deep-200 font-mono">支持 .json / .csv — 自动识别字段：站点、采样时间、水温、潮位、白化比例、实验结果、备注、状态</p>
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleLoadSample();
            }}
            className="px-4 py-1.5 text-sm rounded-lg bg-coral-400 text-white hover:bg-coral-500 transition-colors"
          >
            加载示例数据包
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              rerunDetection();
            }}
            className="px-4 py-1.5 text-sm rounded-lg border border-deep-100 text-deep-300 hover:bg-deep-50 transition-colors flex items-center gap-1"
          >
            <FileSearch size={14} />
            重新检测
          </button>
        </div>
      </div>

      {report && (
        <div className="rounded-xl border border-deep-50 bg-white p-4 animate-fade-up shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-deep-400" />
              <span className="text-sm font-semibold text-deep-500">{report.filename}</span>
              <span className="text-xs px-2 py-0.5 rounded bg-deep-50 text-deep-300 font-mono">
                {report.format.toUpperCase()}
              </span>
            </div>
            <button
              onClick={() => setReport(null)}
              className="text-deep-200 hover:text-deep-400 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-lg bg-deep-50 p-3 text-center">
              <p className="text-xs text-deep-300">总行数</p>
              <p className="text-2xl font-mono font-bold text-deep-500">{report.totalRows}</p>
            </div>
            <div className="rounded-lg bg-reef-400/10 p-3 text-center">
              <p className="text-xs text-reef-500 flex items-center justify-center gap-1">
                <CheckCircle size={12} /> 导入成功
              </p>
              <p className="text-2xl font-mono font-bold text-reef-500">{report.importedCount}</p>
            </div>
            <div className="rounded-lg bg-coral-50 p-3 text-center">
              <p className="text-xs text-coral-500 flex items-center justify-center gap-1">
                <AlertCircle size={12} /> 异常隔离
              </p>
              <p className="text-2xl font-mono font-bold text-coral-500">{report.anomalyCount}</p>
            </div>
          </div>

          {report.skippedRows.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-alert-500 mb-2 flex items-center gap-1">
                <AlertCircle size={12} />
                跳过 {report.skippedRows.length} 行脏数据：
              </p>
              <div className="rounded-lg border border-alert-300 bg-alert-400/5 max-h-28 overflow-y-auto">
                {report.skippedRows.map((s, i) => (
                  <div key={i} className="px-3 py-1.5 border-b last:border-b-0 border-alert-200 flex gap-3 text-xs">
                    <span className="font-mono text-alert-500 shrink-0">第 {s.row} 行</span>
                    <span className="text-deep-400 shrink-0">{s.reason}</span>
                    <span className="text-deep-200 truncate font-mono">{s.raw}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {report.anomalies.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-coral-500 mb-2 flex items-center gap-1">
                <AlertCircle size={12} />
                异常明细已单独拎出（{report.anomalies.length} 条）：
              </p>
              <div className="rounded-lg border border-coral-200 bg-coral-50/50 max-h-44 overflow-y-auto">
                {report.anomalies.map((a, i) => (
                  <div key={i} className="px-3 py-2 border-b last:border-b-0 border-coral-100 flex gap-3 text-xs items-start">
                    <span className="rounded-full bg-coral-400/20 px-2 py-0.5 text-coral-600 font-medium shrink-0">
                      {ANOMALY_LABEL[a.type as keyof typeof ANOMALY_LABEL] ?? a.type}
                    </span>
                    <span className="font-medium text-deep-500 shrink-0">{a.station}</span>
                    <span className="text-deep-300">{a.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
