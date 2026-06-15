import Papa from "papaparse";
import { AnnotationRecord, StatusLabelMap, AbnormalTypeLabelMap, LogActionLabelMap } from "../types";

export interface ExportField {
  key: string;
  label: string;
  getValue: (record: AnnotationRecord) => string | number | boolean;
}

export const defaultExportFields: ExportField[] = [
  { key: "originalLineNumber", label: "原始行号", getValue: (r) => r.originalLineNumber },
  { key: "annotatorMessage", label: "标注员留言", getValue: (r) => r.annotatorMessage },
  { key: "referenceUrl", label: "引用链接", getValue: (r) => r.referenceUrl },
  { key: "urlStatus", label: "链接状态", getValue: (r) => r.urlStatus ? "有效" : "无效(404)" },
  { key: "robotJudgment", label: "机器人判断", getValue: (r) => r.robotJudgment },
  { key: "currentStatus", label: "当前处理状态", getValue: (r) => StatusLabelMap[r.currentStatus] },
  { key: "abnormalType", label: "异常类型", getValue: (r) => AbnormalTypeLabelMap[r.abnormalType] },
  { key: "lastOperator", label: "最后操作人", getValue: (r) => r.lastOperator || "-" },
  { key: "modelOutputMissing", label: "模型输出缺失", getValue: (r) => r.modelOutputMissing ? "是" : "否" },
  { key: "modelOutputSnippet", label: "模型输出片段", getValue: (r) => r.modelOutput?.outputSnippet || "暂无模型输出数据" },
  { key: "modelName", label: "模型名称", getValue: (r) => r.modelOutput?.modelName || "-" },
  { key: "modelConfidence", label: "模型置信度", getValue: (r) => r.modelOutput ? (r.modelOutput.confidence * 100).toFixed(1) + "%" : "-" },
  { key: "modelFilledBy", label: "补录人", getValue: (r) => r.modelOutput?.filledBy || "-" },
  { key: "modelFilledAt", label: "补录时间", getValue: (r) => r.modelOutput?.filledAt ? new Date(r.modelOutput.filledAt).toLocaleString("zh-CN") : "-" },
  { key: "judgmentLogCount", label: "操作日志条数", getValue: (r) => r.judgmentLogs.length },
  { key: "originalAnnotatorMessage", label: "原始标注员留言", getValue: (r) => r.originalSnapshot.annotatorMessage },
  { key: "changeHistory", label: "改前改后历史摘要", getValue: (r) => r.judgmentLogs.map(log => `[${LogActionLabelMap[log.action]}] ${new Date(log.operatedAt).toLocaleString("zh-CN")}: ${log.diffSummary?.join("; ")}`).join(" | ") },
];

export const originalSnapshotFields: ExportField[] = [
  { key: "originalLineNumber", label: "原始行号", getValue: (r) => r.originalLineNumber },
  { key: "originalAnnotatorMessage", label: "原始标注员留言", getValue: (r) => r.originalSnapshot.annotatorMessage },
  { key: "originalReferenceUrl", label: "原始引用链接", getValue: (r) => r.originalSnapshot.referenceUrl },
  { key: "originalUrlStatus", label: "原始链接状态", getValue: (r) => r.originalSnapshot.urlStatus ? "有效" : "无效(404)" },
  { key: "originalRobotJudgment", label: "原始机器人判断", getValue: (r) => r.originalSnapshot.robotJudgment },
  { key: "originalCurrentStatus", label: "原始处理状态", getValue: (r) => StatusLabelMap[r.originalSnapshot.status] },
  { key: "originalAbnormalType", label: "原始异常类型", getValue: (r) => AbnormalTypeLabelMap[r.originalSnapshot.abnormalType] },
  { key: "originalModelOutput", label: "原始模型输出", getValue: (r) => r.originalSnapshot.modelOutputSnippet || "暂无" },
];

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function getExportPreview(records: AnnotationRecord[], count = 5): Record<string, string | number | boolean>[] {
  return records.slice(0, count).map(record => {
    const row: Record<string, string | number | boolean> = {};
    defaultExportFields.forEach(field => {
      row[field.label] = field.getValue(record);
    });
    return row;
  });
}

export function exportToCsv(records: AnnotationRecord[], fields: ExportField[] = defaultExportFields) {
  const data = records.map(record => {
    const row: Record<string, string | number | boolean> = {};
    fields.forEach(field => {
      row[field.label] = field.getValue(record);
    });
    return row;
  });

  const csv = Papa.unparse(data);
  const filename = `质检数据_${new Date().toLocaleDateString("zh-CN").replace(/\//g, "-")}.csv`;
  downloadFile("\uFEFF" + csv, filename, "text/csv;charset=utf-8;");
}

export function exportToJson(records: AnnotationRecord[]) {
  const data = JSON.stringify(records, null, 2);
  const filename = `质检数据_${new Date().toLocaleDateString("zh-CN").replace(/\//g, "-")}.json`;
  downloadFile(data, filename, "application/json");
}

export function exportDetailedReport(records: AnnotationRecord[]) {
  const report = {
    exportTime: new Date().toISOString(),
    totalRecords: records.length,
    statistics: {
      byStatus: {} as Record<string, number>,
      byAbnormalType: {} as Record<string, number>,
      modelOutputMissing: records.filter(r => r.modelOutputMissing).length,
      avgOperations: records.length > 0 ? (records.reduce((sum, r) => sum + r.judgmentLogs.length, 0) / records.length).toFixed(2) : 0
    },
    records: records.map(r => ({
      lineNumber: r.originalLineNumber,
      annotatorMessage: r.annotatorMessage,
      referenceUrl: r.referenceUrl,
      urlStatus: r.urlStatus,
      robotJudgment: r.robotJudgment,
      currentStatus: StatusLabelMap[r.currentStatus],
      abnormalType: AbnormalTypeLabelMap[r.abnormalType],
      modelOutputMissing: r.modelOutputMissing,
      modelOutput: r.modelOutput ? {
        modelName: r.modelOutput.modelName,
        outputSnippet: r.modelOutput.outputSnippet,
        confidence: r.modelOutput.confidence,
        filledBy: r.modelOutput.filledBy,
        filledAt: r.modelOutput.filledAt,
        isBackfill: r.modelOutput.isBackfill
      } : null,
      operationLogs: r.judgmentLogs.map(log => ({
        action: LogActionLabelMap[log.action] || log.action,
        operator: log.operator,
        operatedAt: log.operatedAt,
        remark: log.remark,
        fromStatus: StatusLabelMap[log.fromStatus],
        toStatus: StatusLabelMap[log.toStatus],
        diffSummary: log.diffSummary
      })),
      originalSnapshot: {
        annotatorMessage: r.originalSnapshot.annotatorMessage,
        referenceUrl: r.originalSnapshot.referenceUrl,
        urlStatus: r.originalSnapshot.urlStatus,
        robotJudgment: r.originalSnapshot.robotJudgment,
        status: StatusLabelMap[r.originalSnapshot.status],
        abnormalType: AbnormalTypeLabelMap[r.originalSnapshot.abnormalType]
      }
    }))
  };

  records.forEach(r => {
    const statusLabel = StatusLabelMap[r.currentStatus];
    report.statistics.byStatus[statusLabel] = (report.statistics.byStatus[statusLabel] || 0) + 1;
    const abnormalLabel = AbnormalTypeLabelMap[r.abnormalType];
    report.statistics.byAbnormalType[abnormalLabel] = (report.statistics.byAbnormalType[abnormalLabel] || 0) + 1;
  });

  const data = JSON.stringify(report, null, 2);
  const filename = `复盘报告_${new Date().toLocaleDateString("zh-CN").replace(/\//g, "-")}.json`;
  downloadFile(data, filename, "application/json");
}
