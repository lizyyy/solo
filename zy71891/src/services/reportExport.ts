import { WarningDetail, FilterOptions } from '../types';
import { getExportRange, getExportFilters } from '../utils/viewState';

export interface ExportOptions {
  includeVibrationChart?: boolean;
  includeThresholdTable?: boolean;
  includeJudgment?: boolean;
  includeOperationLogs?: boolean;
  format?: 'csv' | 'json' | 'pdf';
}

export interface ReportData {
  warningDetail: WarningDetail;
  exportRange: { start: string; end: string };
  filters: FilterOptions;
  exportedAt: string;
  options: ExportOptions;
}

export function generateReportContent(warningDetail: WarningDetail, options: ExportOptions = {}): string {
  const exportRange = getExportRange('detail');
  const filters = getExportFilters('detail');
  
  const data: ReportData = {
    warningDetail,
    exportRange,
    filters,
    exportedAt: new Date().toISOString(),
    options,
  };

  return JSON.stringify(data, null, 2);
}

export function generateCSVReport(warningDetail: WarningDetail): string {
  const exportRange = getExportRange('detail');
  
  let csv = '冷库热负荷预警巡检报告\n';
  csv += `设备名称,${warningDetail.deviceName}\n`;
  csv += `设备编号,${warningDetail.deviceId}\n`;
  csv += `预警状态,${getStatusText(warningDetail.status)}\n`;
  csv += `导出时间,${new Date().toLocaleString('zh-CN')}\n`;
  csv += `数据范围,${new Date(exportRange.start).toLocaleString('zh-CN')} 至 ${new Date(exportRange.end).toLocaleString('zh-CN')}\n`;
  csv += '\n';

  csv += '=== 阈值表 ===\n';
  csv += '指标,最小值,最大值,实际值,是否补材料,提交时间\n';
  warningDetail.thresholds.forEach(t => {
    csv += `${t.metric},${t.minValue},${t.maxValue},${t.actualValue},${t.isBackfilled ? '是' : '否'},${new Date(t.submittedAt).toLocaleString('zh-CN')}\n`;
  });
  csv += '\n';

  csv += '=== 振动数据 ===\n';
  csv += '时间,振动值(mm/s),是否手工修改,修改人\n';
  warningDetail.vibrationData.forEach(v => {
    csv += `${new Date(v.timestamp).toLocaleString('zh-CN')},${v.value},${v.isManuallyModified ? '是' : '否'},${v.modifiedBy || ''}\n`;
  });
  csv += '\n';

  csv += '=== 故障判断 ===\n';
  csv += `是否异常,${warningDetail.faultJudgment.isAbnormal ? '是' : '否'}\n`;
  csv += `判断时间,${new Date(warningDetail.faultJudgment.judgedAt).toLocaleString('zh-CN')}\n`;
  csv += `复现顺序,${warningDetail.faultJudgment.reproductionOrder}\n`;
  csv += `判断理由,${warningDetail.faultJudgment.judgmentReason}\n`;
  csv += '\n';

  csv += '=== 判断依据 ===\n';
  warningDetail.faultJudgment.basis.forEach((b, i) => {
    csv += `${i + 1},${b}\n`;
  });
  csv += '\n';

  csv += '=== 操作记录 ===\n';
  csv += '操作时间,操作类型,操作人,描述,是否影响结论\n';
  warningDetail.operationLogs.forEach(log => {
    csv += `${new Date(log.operatedAt).toLocaleString('zh-CN')},${getOperationTypeText(log.type)},${log.operator},${log.description},${log.affectsConclusion ? '是' : '否'}\n`;
  });
  csv += '\n';

  csv += '=== 值班长视图 ===\n';
  csv += `风险等级,${getRiskLevelText(warningDetail.foremanData.riskLevel)}\n`;
  csv += `原因说明,${warningDetail.foremanData.plainReason}\n`;
  csv += '\n';

  csv += '=== 下一步操作 ===\n';
  csv += '序号,操作内容,是否完成\n';
  warningDetail.foremanData.nextSteps.forEach(step => {
    csv += `${step.order},${step.description},${step.completed ? '是' : '否'}\n`;
  });

  return csv;
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportReport(warningDetail: WarningDetail, format: 'csv' | 'json' = 'csv'): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `冷库热负荷预警报告_${warningDetail.deviceName}_${timestamp}.${format}`;

  if (format === 'csv') {
    const content = generateCSVReport(warningDetail);
    downloadFile(content, filename, 'text/csv;charset=utf-8');
  } else {
    const content = generateReportContent(warningDetail);
    downloadFile(content, filename, 'application/json');
  }
}

function getStatusText(status: string): string {
  const map: Record<string, string> = {
    normal: '正常',
    warning: '预警',
    fault: '故障',
  };
  return map[status] || status;
}

function getOperationTypeText(type: string): string {
  const map: Record<string, string> = {
    threshold_early: '阈值表早到',
    repair_late: '维修单晚补',
    vibration_modified: '振动曲线手工改动',
  };
  return map[type] || type;
}

function getRiskLevelText(level: string): string {
  const map: Record<string, string> = {
    low: '低',
    medium: '中',
    high: '高',
  };
  return map[level] || level;
}

export function getExportFilename(warningDetail: WarningDetail, format: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `冷库热负荷预警报告_${warningDetail.deviceName}_${timestamp}.${format}`;
}
