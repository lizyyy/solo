import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileDown,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  FileText,
  Download,
  ExternalLink,
  Check,
  Info,
} from "lucide-react";
import { useAppStore } from "@/store";
import Papa from "papaparse";
import type { ExportFormat, Record } from "@/types";

export function ExportPage() {
  const navigate = useNavigate();
  const { records, checkConsistency, getExportableRecords, users, getCurrentUser } =
    useAppStore();
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");
  const [showSuccess, setShowSuccess] = useState(false);

  const currentUser = getCurrentUser();
  const issues = useMemo(() => checkConsistency(), [records, checkConsistency]);
  const exportableRecords = useMemo(
    () => getExportableRecords(),
    [records, getExportableRecords]
  );

  const errorIssues = issues.filter((i) => i.severity === "error");
  const warningIssues = issues.filter((i) => i.severity === "warning");
  const canExport = errorIssues.length === 0;

  const getOperatorName = (id: string) => {
    return users.find((u) => u.id === id)?.name || "未知";
  };

  const getReviewerName = (id?: string) => {
    if (!id) return "-";
    return users.find((u) => u.id === id)?.name || "未知";
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const generateExportData = (records: Record[]) => {
    return records.map((r) => ({
      记录ID: r.id,
      来源: r.source === "sensor" ? "传感器日志" : "手动录入",
      传感器日志ID: r.sensorLogId || "",
      实验名称: r.experimentName,
      学号: r.studentId || "",
      姓名: r.studentName || "",
      理论焦距_mm: r.focalLength.toFixed(3),
      实测焦距_mm: r.measuredFocalLength.toFixed(3),
      物距_mm: r.objectDistance.toFixed(3),
      像距_mm: r.imageDistance.toFixed(3),
      零点漂移_mm: r.zeroDrift.toFixed(3),
      总误差_mm: r.error.toFixed(3),
      状态:
        r.status === "reviewed"
          ? "已复核"
          : r.status === "pending"
          ? "待处理"
          : "已驳回",
      操作人: getOperatorName(r.operatorId),
      复核人: getReviewerName(r.reviewerId),
      驳回原因: r.rejectReason || "",
      标定表项数: r.calibrationTable.length,
      标定表误差合计_mm: r.calibrationTable
        .reduce((sum, e) => sum + e.error, 0)
        .toFixed(3),
      创建时间: formatTime(r.createdAt),
      更新时间: formatTime(r.updatedAt),
    }));
  };

  const generateDetailedExportData = (records: Record[]) => {
    const rows: any[] = [];
    records.forEach((r) => {
      r.calibrationTable.forEach((entry, idx) => {
        rows.push({
          记录ID: r.id,
          实验名称: r.experimentName,
          学生姓名: r.studentName || "",
          学号: r.studentId || "",
          标定项序号: idx + 1,
          标定项名称: entry.label,
          理论值_mm: entry.theoreticalValue.toFixed(3),
          实测值_mm: entry.measuredValue.toFixed(3),
          误差_mm: entry.error.toFixed(3),
        });
      });
    });
    return rows;
  };

  const handleExport = () => {
    if (!canExport) {
      alert("存在错误问题，请先修正后再导出");
      return;
    }
    if (!currentUser) {
      alert("请先设置操作人");
      return;
    }

    const mainData = generateExportData(exportableRecords);
    const detailData = generateDetailedExportData(exportableRecords);

    if (exportFormat === "csv") {
      const mainCsv = Papa.unparse(mainData);
      const detailCsv = Papa.unparse(detailData);
      const fullCsv =
        "=== 实验批改表（主表） ===\n" +
        mainCsv +
        "\n\n=== 标定表明细 ===\n" +
        detailCsv;

      downloadFile(fullCsv, `实验批改表_${new Date().toISOString().slice(0, 10)}.csv`, "text/csv");
    } else {
      const exportObj = {
        exportTime: new Date().toISOString(),
        exportedBy: currentUser.name,
        recordCount: exportableRecords.length,
        mainTable: mainData,
        calibrationDetails: detailData,
      };
      downloadFile(
        JSON.stringify(exportObj, null, 2),
        `实验批改表_${new Date().toISOString().slice(0, 10)}.json`,
        "application/json"
      );
    }

    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob(["\uFEFF" + content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
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
          <h1 className="text-2xl font-bold text-lab-text flex items-center gap-2">
            <FileDown className="w-6 h-6 text-lab-accent" />
            导出
          </h1>
          <p className="text-sm text-lab-textMuted mt-1">
            导出实验批改表，导出前自动进行一致性校验
          </p>
        </div>
        {showSuccess && (
          <div className="flex items-center gap-2 text-lab-success bg-lab-success/10 px-3 py-2 rounded border border-lab-success/30">
            <Check className="w-4 h-4" />
            <span className="text-sm">导出成功</span>
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="font-medium mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-lab-accent" />
          一致性校验
        </h3>

        {issues.length === 0 ? (
          <div className="flex items-center gap-3 p-4 bg-lab-success/10 border border-lab-success/30 rounded-lg">
            <CheckCircle className="w-6 h-6 text-lab-success flex-shrink-0" />
            <div>
              <p className="font-medium text-lab-success">所有记录校验通过</p>
              <p className="text-sm text-lab-textMuted mt-0.5">
                共检查 {records.length} 条记录，未发现一致性问题
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {errorIssues.length > 0 && (
              <div>
                <p className="text-sm font-medium text-lab-danger mb-2 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  错误 ({errorIssues.length} 项，需修正后才能导出)
                </p>
                <div className="space-y-2">
                  {errorIssues.map((issue, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-3 bg-lab-danger/10 border border-lab-danger/30 rounded-lg"
                    >
                      <AlertCircle className="w-4 h-4 text-lab-danger mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm">
                          <span className="font-medium">{issue.recordName}</span>
                          <span className="text-lab-textMuted mx-2">·</span>
                          {issue.message}
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          navigate(`/correction?recordId=${issue.recordId}`)
                        }
                        className="text-xs text-lab-accent hover:text-lab-accentHover flex items-center gap-1 flex-shrink-0"
                      >
                        <ExternalLink className="w-3 h-3" />
                        去修正
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {warningIssues.length > 0 && (
              <div>
                <p className="text-sm font-medium text-lab-accent mb-2 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  警告 ({warningIssues.length} 项，不阻止导出但建议检查)
                </p>
                <div className="space-y-2">
                  {warningIssues.map((issue, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-3 bg-lab-accent/10 border border-lab-accent/30 rounded-lg"
                    >
                      <AlertTriangle className="w-4 h-4 text-lab-accent mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm">
                          <span className="font-medium">{issue.recordName}</span>
                          <span className="text-lab-textMuted mx-2">·</span>
                          {issue.message}
                        </p>
                      </div>
                      {issue.field === "status" && (
                        <button
                          onClick={() =>
                            navigate(`/review?highlight=${issue.recordId}`)
                          }
                          className="text-xs text-lab-accent hover:text-lab-accentHover flex items-center gap-1 flex-shrink-0"
                        >
                          <ExternalLink className="w-3 h-3" />
                          去复核
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="font-medium mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4 text-lab-accent" />
          导出预览
        </h3>
        <div className="mb-4">
          <p className="text-sm text-lab-textMuted mb-2">
            将导出 <span className="text-lab-accent font-medium">{exportableRecords.length}</span> 条已复核记录
          </p>
          {exportableRecords.length > 0 && (
            <div className="overflow-x-auto max-h-60 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-lab-bgLight">
                  <tr className="border-b border-lab-bgLighter">
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
                      误差(mm)
                    </th>
                    <th className="text-center py-2 px-3 text-lab-textMuted font-medium">
                      复核人
                    </th>
                    <th className="text-center py-2 px-3 text-lab-textMuted font-medium">
                      标定项
                    </th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {exportableRecords.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-lab-bgLighter/50 hover:bg-lab-bg"
                    >
                      <td className="py-2 px-3">{r.experimentName}</td>
                      <td className="py-2 px-3">{r.studentName || "-"}</td>
                      <td className="py-2 px-3 text-right">
                        {r.focalLength.toFixed(3)}
                      </td>
                      <td className="py-2 px-3 text-right">{r.error.toFixed(3)}</td>
                      <td className="py-2 px-3 text-center">
                        {getReviewerName(r.reviewerId)}
                      </td>
                      <td className="py-2 px-3 text-center">
                        {r.calibrationTable.length}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="border-t border-lab-bgLighter pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm text-lab-textMuted">导出格式：</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setExportFormat("csv")}
                  className={`px-3 py-1.5 text-sm rounded border transition-all ${
                    exportFormat === "csv"
                      ? "border-lab-accent bg-lab-accent/10 text-lab-accent"
                      : "border-lab-bgLighter text-lab-textMuted hover:bg-lab-bgLighter/50"
                  }`}
                >
                  CSV
                </button>
                <button
                  onClick={() => setExportFormat("json")}
                  className={`px-3 py-1.5 text-sm rounded border transition-all ${
                    exportFormat === "json"
                      ? "border-lab-accent bg-lab-accent/10 text-lab-accent"
                      : "border-lab-bgLighter text-lab-textMuted hover:bg-lab-bgLighter/50"
                  }`}
                >
                  JSON
                </button>
              </div>
            </div>
            <button
              onClick={handleExport}
              disabled={!canExport || exportableRecords.length === 0}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              导出实验批改表
            </button>
          </div>
          {!canExport && (
            <p className="text-xs text-lab-danger mt-2 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              存在错误问题，请先修正后再导出
            </p>
          )}
          {exportableRecords.length === 0 && canExport && (
            <p className="text-xs text-lab-textMuted mt-2 flex items-center gap-1">
              <Info className="w-3 h-3" />
              暂无可导出的记录，请先完成复核
            </p>
          )}
        </div>
      </div>

      <div className="card bg-lab-accent/5 border-lab-accent/30">
        <h3 className="font-medium mb-2 text-sm text-lab-accent">导出内容说明</h3>
        <ul className="text-sm text-lab-textMuted space-y-1">
          <li>• CSV 格式包含两张表：实验批改表（主表）和标定表明细，Excel 可直接打开</li>
          <li>• JSON 格式包含完整结构化数据，便于程序处理</li>
          <li>• 仅导出状态为「已复核」的记录，「已驳回」和「待处理」记录不会导出</li>
          <li>• 导出文件会记录导出人和导出时间</li>
        </ul>
      </div>
    </div>
  );
}
