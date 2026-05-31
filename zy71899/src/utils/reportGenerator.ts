import type {
  AnalysisRun,
  AnalysisConclusion,
  ShiftRecord,
  WorkLog,
  MaintenanceOrder,
  InspectionReport,
  Batch,
} from '@/types';
import { SHIFT_LABELS, SOURCE_TYPE_LABELS, THRESHOLDS } from '@/types';
import { getFromStore } from './db';
import { formatDateTime } from './helpers';

export function generateInspectionReport(
  batch: Batch,
  analysisRun: AnalysisRun,
  conclusions: AnalysisConclusion[]
): string {
  const lines: string[] = [];
  const separator = '='.repeat(60);
  const subSeparator = '-'.repeat(60);

  lines.push(separator);
  lines.push('管线压力脉冲 - 巡检报告');
  lines.push(separator);
  lines.push('');

  lines.push('【基本信息】');
  lines.push(subSeparator);
  lines.push(`批次号: ${batch.material?.batchNo || 'N/A'}`);
  lines.push(`材料名称: ${batch.material?.name || 'N/A'}`);
  lines.push(`材料规格: ${batch.material?.spec || 'N/A'}`);
  lines.push(`分析版本: v${analysisRun.version}`);
  lines.push(`分析时间: ${formatDateTime(analysisRun.analysisTime)}`);
  lines.push(`分析人员: ${analysisRun.operator || analysisRun.analyst}`);
  lines.push(`分析状态: ${analysisRun.status === 'completed' ? '已完成' : '进行中'}`);
  lines.push('');

  lines.push('【总体结论】');
  lines.push(subSeparator);

  const dangerCount = conclusions.filter((c) => c.thresholdLevel === 'danger').length;
  const warningCount = conclusions.filter((c) => c.thresholdLevel === 'warning').length;

  if (dangerCount > 0) {
    lines.push(`⚠️  检测到 ${dangerCount} 处危险跨档（>10.0 MPa），需要立即处理`);
  }
  if (warningCount > 0) {
    lines.push(`⚠️  检测到 ${warningCount} 处警戒跨档（>8.0 MPa），需要密切关注`);
  }
  if (dangerCount === 0 && warningCount === 0) {
    lines.push('✅  本次分析未检测到阈值跨档，运行正常');
  }
  lines.push('');

  lines.push('【分析详情】');
  lines.push(subSeparator);
  lines.push(`数据时间范围: ${formatDateTime(batch.startTime)} ~ ${batch.endTime ? formatDateTime(batch.endTime) : formatDateTime(Date.now())}`);
  lines.push(`波形数据点数: ${analysisRun.waveformData.length}`);
  lines.push(`阈值跨档次数: ${conclusions.length}`);
  lines.push(`工况日志: ${analysisRun.sourceStats?.workLogCount || 0} 条`);
  lines.push(`班组记录: ${analysisRun.sourceStats?.shiftRecordCount || 0} 条`);
  lines.push(`维修工单: ${analysisRun.sourceStats?.maintenanceCount || 0} 条`);
  lines.push(`分析耗时: ${analysisRun.analysisDurationMs < 1000 ? analysisRun.analysisDurationMs + 'ms' : (analysisRun.analysisDurationMs / 1000).toFixed(1) + 's'}`);
  lines.push('');

  if (conclusions.length > 0) {
    lines.push('【阈值跨档明细】');
    lines.push(subSeparator);
    lines.push('');

    conclusions.forEach((conclusion, index) => {
      const threshold = THRESHOLDS.find((t) => t.level === conclusion.thresholdLevel);
      const levelLabel = conclusion.thresholdLevel === 'danger' ? '危险' : conclusion.thresholdLevel === 'warning' ? '警戒' : '正常';
      const sourceLabel = SOURCE_TYPE_LABELS[conclusion.sourceType] || conclusion.sourceType;

      lines.push(`#${index + 1} ${formatDateTime(conclusion.timestamp)}`);
      lines.push(`  压力值: ${conclusion.pressure.toFixed(2)} MPa`);
      lines.push(`  阈值等级: ${levelLabel} (${threshold?.min.toFixed(1)} - ${threshold?.max.toFixed(1)} MPa)`);
      lines.push(`  数据来源: ${sourceLabel}`);
      lines.push(`  来源ID: ${conclusion.sourceId}`);
      if (conclusion.sourceVersion !== undefined) {
        lines.push(`  来源版本: v${conclusion.sourceVersion}`);
      }
      if (conclusion.sourceLine !== undefined) {
        lines.push(`  来源行号: 第${conclusion.sourceLine}行`);
      }
      lines.push(`  描述: ${conclusion.description}`);
      lines.push('');
    });
  }

  lines.push('【阈值配置】');
  lines.push(subSeparator);
  THRESHOLDS.forEach((t) => {
    const label = t.level === 'danger' ? '危险' : t.level === 'warning' ? '警戒' : '正常';
    lines.push(`${label}: ${t.min.toFixed(1)} - ${t.max.toFixed(1)} MPa`);
  });
  lines.push('');

  lines.push('【追溯说明】');
  lines.push(subSeparator);
  lines.push('1. 所有结论点均可追溯原始数据来源');
  lines.push('2. 点击分析页面的结论点卡片，系统会自动定位到原始记录的对应行号');
  lines.push('3. 工况日志补传新版本时，系统会自动检测变更并发出通知');
  lines.push('4. 历史版本分析记录永久保留，不会被新分析覆盖');
  lines.push('');

  lines.push(separator);
  lines.push(`报告生成时间: ${formatDateTime(Date.now())}`);
  lines.push('本报告包含完整追溯链接，可直接在系统中定位原始数据');
  lines.push(separator);

  return lines.join('\n');
}

export function downloadReport(content: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `巡检报告_${formatDateForFilename(Date.now())}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function generateJsonExport(
  analysisRun: AnalysisRun,
  shiftRecords: ShiftRecord[],
  workLogs: WorkLog[],
  maintenanceOrders: MaintenanceOrder[]
): string {
  const exportData = {
    exportTime: Date.now(),
    analysisRun,
    shiftRecords,
    workLogs,
    maintenanceOrders,
  };
  return JSON.stringify(exportData, null, 2);
}

export function downloadJson(data: string, filename: string): void {
  const blob = new Blob([data], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function getRelatedDataForReport(
  analysisRun: AnalysisRun
): Promise<{
  shiftRecords: ShiftRecord[];
  workLogs: WorkLog[];
  maintenanceOrders: MaintenanceOrder[];
}> {
  const shiftRecords: ShiftRecord[] = [];
  const workLogs: WorkLog[] = [];
  const maintenanceOrders: MaintenanceOrder[] = [];

  if (analysisRun.dataSource) {
    for (const id of analysisRun.dataSource.shiftRecordIds) {
      const record = await getFromStore('shiftRecords', id);
      if (record) shiftRecords.push(record);
    }

    for (const id of analysisRun.dataSource.workLogIds) {
      const log = await getFromStore('workLogs', id);
      if (log) workLogs.push(log);
    }

    for (const id of analysisRun.dataSource.maintenanceOrderIds) {
      const order = await getFromStore('maintenanceOrders', id);
      if (order) maintenanceOrders.push(order);
    }
  }

  return { shiftRecords, workLogs, maintenanceOrders };
}

function formatDateForFilename(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}_${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}`;
}

function getThresholdLabel(level: string): string {
  const labels: Record<string, string> = {
    normal: '正常',
    warning: '警戒',
    danger: '危险',
  };
  return labels[level] || level;
}

export function generateHandoverRecord(
  batch: Batch,
  analysisRun: AnalysisRun,
  shiftRecords: ShiftRecord[]
): string {
  const lines: string[] = [];
  const separator = '='.repeat(60);
  const subSeparator = '-'.repeat(60);

  lines.push(separator);
  lines.push('班组交接记录');
  lines.push(separator);
  lines.push('');

  lines.push('【批次信息】');
  lines.push(subSeparator);
  lines.push(`批次号: ${batch.material?.batchNo || 'N/A'}`);
  lines.push(`材料名称: ${batch.material?.name || 'N/A'}`);
  lines.push(`材料规格: ${batch.material?.spec || 'N/A'}`);
  lines.push('');

  lines.push('【最新分析结论】');
  lines.push(subSeparator);

  const dangerCount = analysisRun.conclusions.filter((c) => c.thresholdLevel === 'danger').length;
  const warningCount = analysisRun.conclusions.filter((c) => c.thresholdLevel === 'warning').length;

  lines.push(`分析版本: v${analysisRun.version}`);
  lines.push(`分析时间: ${formatDateTime(analysisRun.analysisTime)}`);
  lines.push(`分析人员: ${analysisRun.operator || analysisRun.analyst}`);

  if (dangerCount > 0) {
    lines.push(`⚠️  危险跨档: ${dangerCount} 处`);
  }
  if (warningCount > 0) {
    lines.push(`⚠️  警戒跨档: ${warningCount} 处`);
  }
  if (dangerCount === 0 && warningCount === 0) {
    lines.push('✅  运行正常');
  }
  lines.push('');

  lines.push('【近期班组记录】');
  lines.push(subSeparator);

  shiftRecords.slice(0, 5).forEach((record, index) => {
    lines.push(`#${index + 1} ${SHIFT_LABELS[record.shift]} - ${record.operator} - ${formatDateTime(record.recordTime)}`);
    lines.push(`  ${record.content.substring(0, 50)}${record.content.length > 50 ? '...' : ''}`);
    if (record.hasAbnormal) {
      lines.push(`  ⚠️  异常: ${record.abnormalDescription || '有异常情况'}`);
    }
    lines.push('');
  });

  lines.push('【下一班注意事项】');
  lines.push(subSeparator);
  lines.push('1. 请重点关注上述压力异常点，每2小时巡检一次');
  lines.push('2. 相关详细数据请在"管线压力脉冲"系统中查看');
  lines.push('3. 所有分析结论均可追溯原始记录（班组记录/工况日志/维修单）');
  lines.push('4. 补传工况日志旧版本时，系统会自动发出变更通知');
  lines.push('5. 历史分析版本永久保留，不会被新分析覆盖');
  lines.push('');

  lines.push(separator);
  lines.push('交班人: ______________  接班人: ______________');
  lines.push(`交接时间: ${formatDateTime(Date.now())}`);
  lines.push(separator);

  return lines.join('\n');
}
