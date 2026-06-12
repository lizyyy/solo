import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, Download, FileText, CheckCircle, XCircle, Clock, UserPlus, AlertTriangle } from "lucide-react";
import Papa from "papaparse";
import { api } from "@/api/client";
import { useAppStore } from "@/store/appStore";
import StatusBadge from "@/components/StatusBadge";
import type { AudioRecord, ImportPreviewResult } from "@shared/types";

type RecordCategory = "new" | "duplicateCurrent" | "duplicateHistory";

export default function ImportPage() {
  const navigate = useNavigate();
  const { currentUser, setLoading, setError, setImportPreview, importPreview } = useAppStore();
  const [csvContent, setCsvContent] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [activeTab, setActiveTab] = useState<RecordCategory>("new");
  const [showPreview, setShowPreview] = useState(false);
  const [previewResult, setPreviewResult] = useState<ImportPreviewResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvContent(content);
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      setError("请上传 CSV 格式文件");
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvContent(content);
    };
    reader.readAsText(file, "UTF-8");
  };

  const handlePreview = async () => {
    if (!csvContent.trim()) {
      setError("请先选择或上传 CSV 文件");
      return;
    }

    setLoading(true);
    try {
      const res = await api.import.preview(csvContent, fileName || "import.csv");
      setPreviewResult(res.data);
      setImportPreview(res.data);
      setShowPreview(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!previewResult) return;

    setLoading(true);
    try {
      await api.import.confirm(previewResult, currentUser.name);
      setShowPreview(false);
      setCsvContent("");
      setFileName("");
      setImportPreview(null);
      setPreviewResult(null);
      navigate("/results");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const downloadSampleCSV = async () => {
    try {
      const res = await api.import.sampleCSV();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "sample_audio_remarks.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError("下载样例失败");
    }
  };

  const getRecordsForTab = (): AudioRecord[] => {
    if (!previewResult) return [];
    switch (activeTab) {
      case "new":
        return previewResult.newRecords;
      case "duplicateCurrent":
        return previewResult.duplicateCurrent;
      case "duplicateHistory":
        return previewResult.duplicateHistory;
      default:
        return [];
    }
  };

  const tabs: { key: RecordCategory; label: string; icon: any; count: number; color: string }[] = [
    {
      key: "new",
      label: "新记录",
      icon: CheckCircle,
      count: previewResult?.newRecords.length || 0,
      color: "text-success-600 bg-success-50 border-success-200",
    },
    {
      key: "duplicateCurrent",
      label: "本次重复",
      icon: XCircle,
      count: previewResult?.duplicateCurrent.length || 0,
      color: "text-gray-600 bg-gray-50 border-gray-200",
    },
    {
      key: "duplicateHistory",
      label: "历史重复",
      icon: Clock,
      count: previewResult?.duplicateHistory.length || 0,
      color: "text-warning-600 bg-warning-50 border-warning-200",
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-1">导入音频文件备注</h3>
            <p className="text-sm text-gray-500">支持 CSV 格式，系统将自动识别重复和临时替补记录</p>
          </div>
          <button onClick={downloadSampleCSV} className="btn-secondary flex items-center gap-2">
            <Download size={16} />
            下载样例 CSV
          </button>
        </div>

        <div
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50/30 transition-all duration-300 group"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Upload
            size={48}
            className="mx-auto text-gray-400 group-hover:text-primary-500 transition-colors mb-4"
          />
          {fileName ? (
            <div>
              <p className="text-primary-600 font-medium">{fileName}</p>
              <p className="text-sm text-gray-500 mt-1">点击重新选择文件</p>
            </div>
          ) : (
            <div>
              <p className="text-gray-600 font-medium">拖拽文件到此处，或点击选择</p>
              <p className="text-sm text-gray-400 mt-1">支持 CSV 格式</p>
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-4">
          <button
            onClick={handlePreview}
            disabled={!csvContent || useAppStore.getState().loading}
            className="btn-primary flex-1"
          >
            {useAppStore.getState().loading ? "处理中..." : "预览导入结果"}
          </button>
        </div>
      </div>

      {showPreview && previewResult && (
        <div className="card animate-slide-up">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <FileText className="text-primary-600" size={24} />
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">导入预览</h3>
                  <p className="text-sm text-gray-500">
                    批次号：{previewResult.importBatchId} · 共{" "}
                    {previewResult.newRecords.length +
                      previewResult.duplicateCurrent.length +
                      previewResult.duplicateHistory.length}{" "}
                    条记录
                  </p>
                </div>
              </div>

              {previewResult.temporarySubstituteCount > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 bg-warning-50 border border-warning-200 rounded-lg">
                  <UserPlus size={18} className="text-warning-600" />
                  <span className="text-sm text-warning-700">
                    检测到 <b>{previewResult.temporarySubstituteCount}</b> 条临时替补记录，将标记待票务复核
                  </span>
                </div>
              )}

              {previewResult.potentialConflicts > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 bg-danger-50 border border-danger-200 rounded-lg">
                  <AlertTriangle size={18} className="text-danger-600" />
                  <span className="text-sm text-danger-700">
                    检测到 <b>{previewResult.potentialConflicts}</b> 个潜在冲突
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex border-b border-gray-200">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-all ${
                  activeTab === tab.key
                    ? "border-primary-600 text-primary-600 bg-primary-50/50"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
                <span className={`px-2 py-0.5 rounded-full text-xs border ${tab.color}`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">状态</th>
                  <th className="table-header">音频文件ID</th>
                  <th className="table-header">音频文件名</th>
                  <th className="table-header">课程名称</th>
                  <th className="table-header">治疗师</th>
                  <th className="table-header">治疗日期</th>
                  <th className="table-header">时长</th>
                  <th className="table-header">金额</th>
                  <th className="table-header">备注</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {getRecordsForTab().map((record) => (
                  <tr
                    key={record.id}
                    className={`hover:bg-gray-50 transition-colors ${
                      record.isTemporarySubstitute ? "border-l-4 border-l-warning-500" : ""
                    }`}
                  >
                    <td className="table-cell">
                      <StatusBadge status={record.status} />
                    </td>
                    <td className="table-cell font-mono text-xs">{record.audioFileId}</td>
                    <td className="table-cell">{record.audioFileName}</td>
                    <td className="table-cell">{record.courseName}</td>
                    <td className="table-cell">
                      <span className={record.isTemporarySubstitute ? "text-warning-700 font-medium" : ""}>
                        {record.therapistName}
                      </span>
                      {record.isTemporarySubstitute && (
                        <span className="ml-2 text-xs text-warning-600">(临时替补)</span>
                      )}
                    </td>
                    <td className="table-cell">{record.sessionDate}</td>
                    <td className="table-cell">{record.duration}分钟</td>
                    <td className="table-cell font-medium">¥{record.amount.toFixed(2)}</td>
                    <td className="table-cell max-w-xs truncate" title={record.remark}>
                      {record.remark}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-6 border-t border-gray-200 flex gap-4 justify-end">
            <button onClick={() => setShowPreview(false)} className="btn-secondary">
              取消
            </button>
            <button onClick={handleConfirmImport} className="btn-primary">
              确认导入
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
