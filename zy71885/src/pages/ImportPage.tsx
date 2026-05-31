import { useState, useCallback, useRef } from "react";
import {
  Upload,
  FileText,
  Plus,
  Check,
  X,
  Download,
  Info,
  AlertCircle,
} from "lucide-react";
import Papa from "papaparse";
import { useAppStore } from "@/store";
import { generateCalibrationTable, sampleSensorLogCsv } from "@/utils/mockData";
import type { Record } from "@/types";

type ImportTab = "sensor" | "manual";

interface ParsedRecord {
  sensorLogId?: string;
  experimentName: string;
  studentId?: string;
  studentName?: string;
  focalLength: number;
  measuredFocalLength: number;
  objectDistance: number;
  imageDistance: number;
  zeroDrift: number;
  error: number;
}

export function ImportPage() {
  const { currentUserId, addRecordsBatch, addRecord, getCurrentUser } = useAppStore();
  const [activeTab, setActiveTab] = useState<ImportTab>("sensor");
  const [isDragging, setIsDragging] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const [previewRecords, setPreviewRecords] = useState<ParsedRecord[]>([]);
  const [importSuccess, setImportSuccess] = useState(false);

  const [manualForm, setManualForm] = useState({
    experimentName: "",
    studentId: "",
    studentName: "",
    focalLength: 100,
    measuredFocalLength: 99.98,
    objectDistance: 200,
    imageDistance: 200.03,
    zeroDrift: 0.02,
    error: 0.03,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentUser = getCurrentUser();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      parseFile(files[0]);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      parseFile(files[0]);
    }
  };

  const parseFile = (file: File) => {
    setParseProgress(0);
    const isJson = file.name.endsWith(".json");

    if (isJson) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
          const records = Array.isArray(data) ? data : [data];
          processParsedData(records, "json");
        } catch (err) {
          alert("JSON 格式解析失败");
        }
      };
      reader.readAsText(file);
    } else {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        step: (results, parser) => {
          setParseProgress((prev) => Math.min(prev + 2, 90));
        },
        complete: (results) => {
          setParseProgress(100);
          processParsedData(results.data as any[], "csv");
        },
      });
    }
  };

  const processParsedData = (data: any[], format: "csv" | "json") => {
    const records: ParsedRecord[] = data.map((row) => ({
      sensorLogId: row.sensor_log_id || row.sensorLogId,
      experimentName: row.experiment_name || row.experimentName || "未命名实验",
      studentId: row.student_id || row.studentId,
      studentName: row.student_name || row.studentName,
      focalLength: parseFloat(row.focal_length || row.focalLength || 0),
      measuredFocalLength: parseFloat(
        row.measured_focal_length || row.measuredFocalLength || 0
      ),
      objectDistance: parseFloat(row.object_distance || row.objectDistance || 0),
      imageDistance: parseFloat(row.image_distance || row.imageDistance || 0),
      zeroDrift: parseFloat(row.zero_drift || row.zeroDrift || 0),
      error: parseFloat(row.error || 0),
    }));
    setPreviewRecords(records);
    setParseProgress(0);
  };

  const handleConfirmImport = () => {
    if (!currentUserId) {
      alert("请先设置操作人");
      return;
    }
    const recordData = previewRecords.map((r) => ({
      ...r,
      source: "sensor" as const,
      operatorId: currentUserId,
      calibrationTable: generateCalibrationTable(r.focalLength, r.measuredFocalLength),
    }));
    addRecordsBatch(
      recordData,
      "sensor",
      "传感器日志导入，需复核零点漂移"
    );
    setImportSuccess(true);
    setPreviewRecords([]);
    setTimeout(() => setImportSuccess(false), 3000);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId) {
      alert("请先设置操作人");
      return;
    }
    addRecord(
      {
        ...manualForm,
        source: "manual",
        operatorId: currentUserId,
        calibrationTable: generateCalibrationTable(
          manualForm.focalLength,
          manualForm.measuredFocalLength
        ),
      },
      "manual",
      "手动录入实验记录，需复核"
    );
    setManualForm({
      experimentName: "",
      studentId: "",
      studentName: "",
      focalLength: 100,
      measuredFocalLength: 99.98,
      objectDistance: 200,
      imageDistance: 200.03,
      zeroDrift: 0.02,
      error: 0.03,
    });
    setImportSuccess(true);
    setTimeout(() => setImportSuccess(false), 3000);
  };

  const downloadSample = () => {
    const blob = new Blob([sampleSensorLogCsv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sensor-log-sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadSampleData = () => {
    const sample: ParsedRecord[] = [
      {
        sensorLogId: "LOG-SAMPLE-001",
        experimentName: "凸透镜焦距测量-甲组",
        studentId: "202401001",
        studentName: "张三",
        focalLength: 100,
        measuredFocalLength: 99.985,
        objectDistance: 200,
        imageDistance: 200.032,
        zeroDrift: 0.015,
        error: 0.032,
      },
      {
        sensorLogId: "LOG-SAMPLE-002",
        experimentName: "凸透镜焦距测量-乙组",
        studentId: "202401002",
        studentName: "李四",
        focalLength: 100,
        measuredFocalLength: 99.972,
        objectDistance: 250,
        imageDistance: 166.698,
        zeroDrift: -0.028,
        error: 0.031,
      },
      {
        sensorLogId: "LOG-SAMPLE-003",
        experimentName: "凹透镜焦距测量-丙组",
        studentId: "202401003",
        studentName: "王五",
        focalLength: -150,
        measuredFocalLength: -149.961,
        objectDistance: 300,
        imageDistance: -99.983,
        zeroDrift: 0.039,
        error: 0.05,
      },
    ];
    setPreviewRecords(sample);
  };

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="card max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-lab-accent mx-auto mb-4" />
          <h2 className="text-lg font-medium mb-2">请先设置操作人</h2>
          <p className="text-sm text-lab-textMuted mb-4">
            所有操作都会记录操作人信息，请先在左下角设置当前操作人
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-lab-text">数据导入</h1>
          <p className="text-sm text-lab-textMuted mt-1">
            当前操作人：<span className="text-lab-accent">{currentUser.name}</span>
          </p>
        </div>
        {importSuccess && (
          <div className="flex items-center gap-2 text-lab-success bg-lab-success/10 px-3 py-2 rounded border border-lab-success/30">
            <Check className="w-4 h-4" />
            <span className="text-sm">导入成功</span>
          </div>
        )}
      </div>

      <div className="flex gap-2 border-b border-lab-bgLighter">
        <button
          onClick={() => setActiveTab("sensor")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "sensor"
              ? "border-lab-accent text-lab-accent"
              : "border-transparent text-lab-textMuted hover:text-lab-text"
          }`}
        >
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4" />
            传感器日志导入
          </div>
        </button>
        <button
          onClick={() => setActiveTab("manual")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "manual"
              ? "border-lab-accent text-lab-accent"
              : "border-transparent text-lab-textMuted hover:text-lab-text"
          }`}
        >
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            手动补录
          </div>
        </button>
      </div>

      {activeTab === "sensor" && (
        <div className="space-y-6">
          <div className="card">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all ${
                isDragging
                  ? "border-lab-accent bg-lab-accent/10 shadow-glow-amber"
                  : "border-lab-bgLighter hover:border-lab-accent/50 hover:bg-lab-bgLight/50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Upload className="w-12 h-12 text-lab-textMuted mx-auto mb-4" />
              <p className="text-lg font-medium mb-1">拖拽文件到此处或点击选择</p>
              <p className="text-sm text-lab-textMuted mb-4">
                支持 CSV 和 JSON 格式
              </p>
              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadSample();
                  }}
                  className="btn-secondary text-sm"
                >
                  <Download className="w-4 h-4 inline mr-2" />
                  下载样例
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    loadSampleData();
                  }}
                  className="btn-secondary text-sm"
                >
                  <FileText className="w-4 h-4 inline mr-2" />
                  加载样例
                </button>
              </div>
            </div>

            {parseProgress > 0 && (
              <div className="mt-4">
                <div className="h-2 bg-lab-bg rounded-full overflow-hidden">
                  <div
                    className="h-full bg-lab-accent transition-all duration-200"
                    style={{ width: `${parseProgress}%` }}
                  />
                </div>
                <p className="text-xs text-lab-textMuted mt-2 text-center">
                  解析中... {parseProgress}%
                </p>
              </div>
            )}
          </div>

          {previewRecords.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium flex items-center gap-2">
                  <Info className="w-4 h-4 text-lab-accent" />
                  导入预览（共 {previewRecords.length} 条）
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPreviewRecords([])}
                    className="btn-secondary text-sm"
                  >
                    <X className="w-4 h-4 inline mr-1" />
                    取消
                  </button>
                  <button
                    onClick={handleConfirmImport}
                    className="btn-primary text-sm"
                  >
                    <Check className="w-4 h-4 inline mr-1" />
                    确认导入
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-lab-bgLighter">
                      <th className="text-left py-2 px-3 text-lab-textMuted font-medium">
                        日志ID
                      </th>
                      <th className="text-left py-2 px-3 text-lab-textMuted font-medium">
                        实验名称
                      </th>
                      <th className="text-left py-2 px-3 text-lab-textMuted font-medium">
                        学生
                      </th>
                      <th className="text-right py-2 px-3 text-lab-textMuted font-medium">
                        焦距(mm)
                      </th>
                      <th className="text-right py-2 px-3 text-lab-textMuted font-medium">
                        零点漂移(mm)
                      </th>
                      <th className="text-right py-2 px-3 text-lab-textMuted font-medium">
                        误差(mm)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {previewRecords.slice(0, 20).map((r, i) => (
                      <tr
                        key={i}
                        className="border-b border-lab-bgLighter/50 hover:bg-lab-bg"
                      >
                        <td className="py-2 px-3 text-lab-textMuted">
                          {r.sensorLogId}
                        </td>
                        <td className="py-2 px-3">{r.experimentName}</td>
                        <td className="py-2 px-3">
                          {r.studentName || "-"}
                          {r.studentId && (
                            <span className="text-lab-textMuted ml-2">
                              ({r.studentId})
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right">{r.focalLength}</td>
                        <td
                          className={`py-2 px-3 text-right ${
                            Math.abs(r.zeroDrift) > 0.02
                              ? "text-lab-danger"
                              : ""
                          }`}
                        >
                          {r.zeroDrift.toFixed(3)}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {r.error.toFixed(3)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {previewRecords.length > 20 && (
                  <p className="text-center text-sm text-lab-textMuted mt-2">
                    仅显示前 20 条，共 {previewRecords.length} 条
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "manual" && (
        <div className="card">
          <h3 className="font-medium mb-4">手动录入实验记录</h3>
          <form onSubmit={handleManualSubmit} className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs text-lab-textMuted mb-1">
                实验名称 *
              </label>
              <input
                type="text"
                required
                value={manualForm.experimentName}
                onChange={(e) =>
                  setManualForm({ ...manualForm, experimentName: e.target.value })
                }
                className="input-field"
                placeholder="如：凸透镜焦距测量-甲组"
              />
            </div>
            <div>
              <label className="block text-xs text-lab-textMuted mb-1">学号</label>
              <input
                type="text"
                value={manualForm.studentId}
                onChange={(e) =>
                  setManualForm({ ...manualForm, studentId: e.target.value })
                }
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-xs text-lab-textMuted mb-1">姓名</label>
              <input
                type="text"
                value={manualForm.studentName}
                onChange={(e) =>
                  setManualForm({ ...manualForm, studentName: e.target.value })
                }
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-xs text-lab-textMuted mb-1">
                理论焦距 (mm) *
              </label>
              <input
                type="number"
                step="0.001"
                required
                value={manualForm.focalLength}
                onChange={(e) =>
                  setManualForm({
                    ...manualForm,
                    focalLength: parseFloat(e.target.value),
                  })
                }
                className="input-field font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-lab-textMuted mb-1">
                实测焦距 (mm) *
              </label>
              <input
                type="number"
                step="0.001"
                required
                value={manualForm.measuredFocalLength}
                onChange={(e) =>
                  setManualForm({
                    ...manualForm,
                    measuredFocalLength: parseFloat(e.target.value),
                  })
                }
                className="input-field font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-lab-textMuted mb-1">
                物距 (mm) *
              </label>
              <input
                type="number"
                step="0.001"
                required
                value={manualForm.objectDistance}
                onChange={(e) =>
                  setManualForm({
                    ...manualForm,
                    objectDistance: parseFloat(e.target.value),
                  })
                }
                className="input-field font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-lab-textMuted mb-1">
                像距 (mm) *
              </label>
              <input
                type="number"
                step="0.001"
                required
                value={manualForm.imageDistance}
                onChange={(e) =>
                  setManualForm({
                    ...manualForm,
                    imageDistance: parseFloat(e.target.value),
                  })
                }
                className="input-field font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-lab-textMuted mb-1">
                零点漂移 (mm) *
              </label>
              <input
                type="number"
                step="0.001"
                required
                value={manualForm.zeroDrift}
                onChange={(e) =>
                  setManualForm({
                    ...manualForm,
                    zeroDrift: parseFloat(e.target.value),
                  })
                }
                className="input-field font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-lab-textMuted mb-1">
                误差 (mm) *
              </label>
              <input
                type="number"
                step="0.001"
                required
                value={manualForm.error}
                onChange={(e) =>
                  setManualForm({
                    ...manualForm,
                    error: parseFloat(e.target.value),
                  })
                }
                className="input-field font-mono"
              />
            </div>
            <div className="col-span-2 flex justify-end gap-2 pt-2">
              <button type="reset" className="btn-secondary">
                重置
              </button>
              <button type="submit" className="btn-primary">
                <Plus className="w-4 h-4 inline mr-1" />
                添加记录
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
