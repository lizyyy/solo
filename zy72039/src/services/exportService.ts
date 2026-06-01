import type { GameState, GameRecord, ExportMetadata } from '../types';
import { formatTimestamp } from '../utils/timeUtils';
import { CONFIG_VERSION, OPERATOR } from '../config/gameConfig';
import { DATA_FLAG_LABELS, FAILURE_REASON_LABELS, DATA_SOURCE_LABELS } from '../types';

const FIELD_DESCRIPTIONS: Record<string, string> = {
  sequence: '流水号',
  formattedTime: '记录时间',
  source: '数据来源',
  rawValue: '原始值(100%保留)',
  processedValue: '处理后的值',
  load: '当前总载荷',
  note: '原始备注(永不清洗)',
  flags: '数据标记',
  isSuccess: '本轮结果',
  failureReason: '失败原因分类',
  failureDetail: '失败原因详情',
  processingNote: '处理说明(给阿蓝交接用)',
  operator: '处理人',
  responseTime: '响应时间(毫秒)',
  roundNumber: '所属回合',
  id: '记录唯一标识',
  timestamp: '时间戳',
};

function escapeCsvValue(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function generateMetadata(state: GameState): ExportMetadata {
  const records = state.records;
  const flaggedRecords = records.filter(r => !r.flags.includes('normal')).length;
  const validRecords = records.filter(r => r.processedValue !== null).length;

  return {
    exportTime: formatTimestamp(Date.now()),
    gameName: state.config?.name || '未命名游戏',
    totalRecords: records.length,
    validRecords,
    flaggedRecords,
    gameStartTime: state.startTime ? formatTimestamp(state.startTime) : '-',
    gameEndTime: records.length > 0 ? formatTimestamp(records[records.length - 1].timestamp) : '-',
    operator: OPERATOR,
    configVersion: CONFIG_VERSION,
    fieldDescriptions: FIELD_DESCRIPTIONS,
  };
}

function generateMetadataHeader(metadata: ExportMetadata): string {
  const lines: string[] = [];
  
  lines.push('# 桥梁载荷闯关 - 导出报告');
  lines.push(`# 导出时间: ${metadata.exportTime}`);
  lines.push(`# 游戏名称: ${metadata.gameName}`);
  lines.push(`# 开始时间: ${metadata.gameStartTime}`);
  lines.push(`# 结束时间: ${metadata.gameEndTime}`);
  lines.push(`# 总记录数: ${metadata.totalRecords}`);
  lines.push(`# 有效记录数: ${metadata.validRecords}`);
  lines.push(`# 标记记录数: ${metadata.flaggedRecords}`);
  lines.push(`# 操作人: ${metadata.operator}`);
  lines.push(`# 配置版本: ${metadata.configVersion}`);
  lines.push('# 字段说明:');
  
  const fieldEntries = Object.entries(metadata.fieldDescriptions);
  fieldEntries.forEach(([key, desc]) => {
    lines.push(`#   ${key}=${desc}`);
  });
  
  return lines.join('\n');
}

function recordToCsvRow(record: GameRecord): string {
  const values = [
    record.sequence,
    record.formattedTime,
    DATA_SOURCE_LABELS[record.source] || record.source,
    record.rawValue,
    record.processedValue,
    record.load,
    record.note,
    record.flags.map(f => DATA_FLAG_LABELS[f] || f).join('|'),
    record.isSuccess ? '成功' : '失败',
    record.failureReason ? (FAILURE_REASON_LABELS[record.failureReason] || record.failureReason) : '',
    record.failureDetail,
    record.processingNote,
    record.operator,
    record.responseTime,
    record.roundNumber,
    record.id,
  ];
  
  return values.map(v => escapeCsvValue(v)).join(',');
}

export function generateCsvContent(state: GameState): string {
  const metadata = generateMetadata(state);
  const header = generateMetadataHeader(metadata);
  
  const csvHeader = [
    '流水号',
    '记录时间',
    '数据来源',
    '原始值',
    '处理值',
    '当前载荷',
    '原始备注',
    '数据标记',
    '结果',
    '失败原因',
    '失败详情',
    '处理说明',
    '处理人',
    '响应时间(ms)',
    '回合',
    '记录ID',
  ].join(',');
  
  const rows = state.records.map(recordToCsvRow);
  
  return `${header}\n${csvHeader}\n${rows.join('\n')}`;
}

export function downloadCsv(content: string, filename: string): void {
  try {
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('下载CSV失败:', error);
    throw error;
  }
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text).catch(err => {
    console.error('复制到剪贴板失败:', err);
    throw err;
  });
}

export function generateExportFilename(prefix: string = '桥梁载荷闯关'): string {
  const now = new Date();
  const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  return `${prefix}_${timestamp}.csv`;
}

export interface ExportResult {
  success: boolean;
  content?: string;
  filename?: string;
  error?: string;
}

export async function exportToCsv(state: GameState): Promise<ExportResult> {
  try {
    const content = generateCsvContent(state);
    const filename = generateExportFilename(state.config?.name || '桥梁载荷闯关');
    downloadCsv(content, filename);
    return {
      success: true,
      content,
      filename,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return {
      success: false,
      error: errorMessage,
    };
  }
}

export async function exportToClipboard(state: GameState): Promise<ExportResult> {
  try {
    const content = generateCsvContent(state);
    await copyToClipboard(content);
    return {
      success: true,
      content,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return {
      success: false,
      error: errorMessage,
    };
  }
}
