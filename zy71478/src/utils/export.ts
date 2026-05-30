import { CompleteRecord, ViewState, ExportPayload } from '../types';
import { calculateViewHash } from './crypto';
import { formatDateTime, formatVelocity, formatTemperature, formatDistance, formatTime, formatPercent } from './format';

export function generateFilterDescription(viewState: ViewState): string {
  const parts: string[] = [];
  const { filters } = viewState;

  if (filters.temperatureRange[0] !== -50 || filters.temperatureRange[1] !== 100) {
    parts.push(`温度范围: ${filters.temperatureRange[0]}℃ ~ ${filters.temperatureRange[1]}℃`);
  }

  const dateStart = formatDate(filters.dateRange[0]);
  const dateEnd = formatDate(filters.dateRange[1]);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  if (filters.dateRange[0].getTime() !== thirtyDaysAgo.getTime() || 
      filters.dateRange[1].toDateString() !== new Date().toDateString()) {
    parts.push(`日期范围: ${dateStart} ~ ${dateEnd}`);
  }

  if (filters.deviceIds.length > 0) {
    parts.push(`设备编号: ${filters.deviceIds.join(', ')}`);
  }

  if (filters.conclusionTypes.length > 0) {
    const labels = filters.conclusionTypes.map(t => {
      if (t === 'consistent') return '一致';
      if (t === 'inconsistent') return '不一致';
      return '警告';
    });
    parts.push(`结论类型: ${labels.join(', ')}`);
  }

  if (parts.length === 0) {
    return '全部数据';
  }

  return parts.join('; ');
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('zh-CN');
}

export function recordToCSV(records: CompleteRecord[]): string {
  const headers = [
    '序号',
    '记录ID',
    '创建时间',
    '温度(℃)',
    '测距(m)',
    '时间差',
    '时间单位',
    '设备偏差(m/s)',
    '设备编号',
    '理论声速(m/s)',
    '测量声速(m/s)',
    '校准后声速(m/s)',
    '绝对偏差(m/s)',
    '相对偏差(%)',
    '结论',
    '置信度(%)',
    '异常数量',
    '印证级别',
    '操作人员',
    '备注',
  ];

  const rows = records.map((record, index) => {
    const { input, result, evidenceChain, anomalies } = record;
    return [
      index + 1,
      record.id,
      formatDateTime(record.createdAt),
      input.temperature?.toString() || '',
      input.distance?.toString() || '',
      input.timeDiff?.toString() || '',
      input.timeUnit,
      input.deviceDeviation?.toString() || '',
      input.deviceId || '',
      result.theoreticalValue.toFixed(2),
      Number.isNaN(result.measuredValue) ? '' : result.measuredValue.toFixed(2),
      Number.isNaN(result.calibratedValue) ? '' : result.calibratedValue.toFixed(2),
      Number.isNaN(result.deviation) ? '' : result.deviation.toFixed(2),
      Number.isNaN(result.deviationPercent) ? '' : result.deviationPercent.toFixed(2),
      getConclusionLabel(result.conclusion),
      evidenceChain.confidence.toString(),
      anomalies.length.toString(),
      getCorroborationLabel(evidenceChain.corroborationLevel),
      input.operator || '',
      input.notes || '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

function getConclusionLabel(conclusion: string): string {
  const labels: Record<string, string> = {
    consistent: '一致',
    inconsistent: '不一致',
    warning: '警告',
  };
  return labels[conclusion] || conclusion;
}

function getCorroborationLabel(level: string): string {
  const labels: Record<string, string> = {
    full: '完全印证',
    partial: '部分印证',
    none: '无印证',
  };
  return labels[level] || level;
}

export async function createExportPayload(
  records: CompleteRecord[],
  viewState: ViewState
): Promise<ExportPayload> {
  const viewHash = await calculateViewHash(JSON.parse(JSON.stringify(viewState)));
  
  return {
    data: records,
    viewState: JSON.parse(JSON.stringify(viewState)),
    viewHash,
    exportTimestamp: Date.now(),
    filterDescription: generateFilterDescription(viewState),
  };
}

export function downloadCSV(records: CompleteRecord[], viewState: ViewState, filename?: string): void {
  const csv = recordToCSV(records);
  const filterDesc = generateFilterDescription(viewState);
  const header = `# 声速温度校准表导出\n` +
                 `# 导出时间: ${formatDateTime(Date.now())}\n` +
                 `# 筛选条件: ${filterDesc}\n` +
                 `# 数据条数: ${records.length}\n` +
                 `# 视图哈希: ${Date.now().toString(36)}\n\n`;
  
  const fullContent = header + csv;
  const blob = new Blob([fullContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `声速校准表_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadJSON(payload: ExportPayload, filename?: string): void {
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `声速校准表_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function generateEvidenceReport(record: CompleteRecord): string {
  const { input, result, evidenceChain, anomalies, auditLog } = record;
  
  let report = `╔══════════════════════════════════════════════════════════════╗\n`;
  report += `║               声速温度校准表 - 完整证据报告                 ║\n`;
  report += `╚══════════════════════════════════════════════════════════════╝\n\n`;
  
  report += `【基本信息】\n`;
  report += `记录ID: ${record.id}\n`;
  report += `创建时间: ${formatDateTime(record.createdAt)}\n`;
  report += `算法版本: ${result.algorithmVersion}\n`;
  report += `输入哈希: ${result.inputHash}\n`;
  report += `操作人员: ${input.operator || '未记录'}\n`;
  report += `\n`;
  
  report += `【输入参数】\n`;
  report += `温度: ${input.temperature !== null ? formatTemperature(input.temperature) : '缺失(使用默认20℃)'}\n`;
  report += `测距: ${input.distance !== null ? formatDistance(input.distance) : '缺失'}\n`;
  report += `时间差: ${input.timeDiff !== null ? formatTime(input.timeDiff, input.timeUnit) : '缺失'}\n`;
  report += `设备偏差: ${input.deviceDeviation !== null ? `${input.deviceDeviation} m/s` : '缺失(使用默认±0.5m/s)'}\n`;
  report += `设备编号: ${input.deviceId || '未提供'}\n`;
  report += `\n`;
  
  report += `【计算结果】\n`;
  report += `理论声速: ${formatVelocity(result.theoreticalValue)}\n`;
  report += `测量声速: ${Number.isNaN(result.measuredValue) ? '无法计算' : formatVelocity(result.measuredValue)}\n`;
  report += `校准后声速: ${Number.isNaN(result.calibratedValue) ? '无法计算' : formatVelocity(result.calibratedValue)}\n`;
  report += `绝对偏差: ${Number.isNaN(result.deviation) ? '--' : `${result.deviation.toFixed(2)} m/s`}\n`;
  report += `相对偏差: ${formatPercent(result.deviationPercent)}\n`;
  report += `结论: ${getConclusionLabel(result.conclusion)}\n`;
  report += `\n`;
  
  report += `【异常检测】\n`;
  if (anomalies.length === 0) {
    report += `无异常\n`;
  } else {
    anomalies.forEach((anomaly, i) => {
      report += `${i + 1}. [${anomaly.severity === 'error' ? '错误' : '警告'}] ${anomaly.type}\n`;
      report += `   说明: ${anomaly.explanation}\n`;
      report += `   影响: ${anomaly.impact}\n`;
      report += `   建议: ${anomaly.suggestion}\n`;
      if (anomaly.field) {
        report += `   相关字段: ${anomaly.field}`;
        if (anomaly.value !== undefined) {
          report += ` = ${anomaly.value}`;
        }
        report += `\n`;
      }
      report += `   检测顺序: #${anomaly.sequence}\n\n`;
    });
  }
  
  report += `【证据链】\n`;
  report += `整体结论: ${evidenceChain.overallConclusion}\n`;
  report += `置信度: ${evidenceChain.confidence}%\n`;
  report += `印证级别: ${getCorroborationLabel(evidenceChain.corroborationLevel)}\n`;
  if (evidenceChain.contradictions.length > 0) {
    report += `矛盾点:\n`;
    evidenceChain.contradictions.forEach((c, i) => {
      report += `  ${i + 1}. ${c}\n`;
    });
  }
  report += `\n证据明细(按处理顺序):\n`;
  evidenceChain.items.forEach((item, i) => {
    report += `${i + 1}. [#${item.sequence}] ${item.title}\n`;
    report += `   来源: ${item.source}\n`;
    report += `   内容: ${item.content}\n`;
    if (item.value !== undefined) {
      report += `   数值: ${item.value}${item.unit ? ' ' + item.unit : ''}\n`;
    }
    report += `\n`;
  });
  
  report += `【计算步骤溯源】\n`;
  result.calculationSteps.forEach((step, i) => {
    report += `${i + 1}. 步骤 ${step.stepOrder}: ${step.description}\n`;
    report += `   公式: ${step.formula}\n`;
    report += `   中间值: ${step.intermediateValue} ${step.unit}\n`;
    report += `   输入: ${JSON.stringify(step.inputs)}\n\n`;
  });
  
  report += `【审计日志】\n`;
  auditLog.forEach((log, i) => {
    report += `${i + 1}. [#${log.sequence}] ${formatDateTime(log.timestamp)} - ${log.action}\n`;
    report += `   详情: ${JSON.stringify(log.details)}\n\n`;
  });
  
  if (input.notes) {
    report += `【备注】\n${input.notes}\n\n`;
  }
  
  report += `══════════════════════════════════════════════════════════════\n`;
  report += `报告生成时间: ${formatDateTime(Date.now())}\n`;
  report += `══════════════════════════════════════════════════════════════\n`;
  
  return report;
}

export function downloadReport(record: CompleteRecord): void {
  const report = generateEvidenceReport(record);
  const blob = new Blob([report], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `证据报告_${record.id.slice(0, 8)}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
