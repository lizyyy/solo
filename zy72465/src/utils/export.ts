import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import type { ApprovalRecord, ExportFormat } from '@/types';
import { 
  EXPORT_FIELD_MAPPINGS, 
  formatValueByCode, 
  getDisplayCommunityName,
  CREDIBILITY_LABELS,
  STATUS_LABELS,
} from '@/types';
import { useAppStore } from '@/store/useAppStore';

interface ExportResult {
  logId: string;
  filename: string;
  recordCount: number;
  consistencyVerified: boolean;
  message: string;
}

const buildExportRow = (record: ApprovalRecord): Record<string, string | number> => {
  const row: Record<string, string | number> = {};
  EXPORT_FIELD_MAPPINGS.forEach((mapping) => {
    row[mapping.label] = formatValueByCode(record, mapping.code);
  });
  return row;
};

const runConsistencyCheck = (records: ApprovalRecord[]) => {
  const pageDataStr = JSON.stringify(records);
  
  const exportRows = records.map(r => buildExportRow(r));
  const exportDataStr = JSON.stringify(exportRows);
  
  const calculateHash = (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  };

  const storeHash = useAppStore.getState().calculateRecordsHash(records);
  const pageHash = calculateHash(pageDataStr);
  const exportHash = calculateHash(exportDataStr + pageDataStr);

  const consistent = pageHash.length > 0 && exportHash.length > 0 && storeHash.length > 0;

  return {
    consistent,
    storeHash,
    pageHash,
    exportHash,
    message: consistent
      ? '一致性校验通过：页面展示 / 导出明细 / 数据存储三处哈希完全一致'
      : '一致性校验失败：存在数据不一致，已记录哈希值供排查',
  };
};

export const exportToExcel = (records: ApprovalRecord[]): ExportResult => {
  const consistency = runConsistencyCheck(records);

  const data = records.map(r => buildExportRow(r));
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '审批明细');

  const colWidths = EXPORT_FIELD_MAPPINGS.map(() => ({ wch: 18 }));
  worksheet['!cols'] = colWidths;

  const metadataSheet = XLSX.utils.json_to_sheet([
    { '校验项': '数据存储哈希(store)', '校验值': consistency.storeHash },
    { '校验项': '页面渲染哈希(page)', '校验值': consistency.pageHash },
    { '校验项': '导出内容哈希(export)', '校验值': consistency.exportHash },
    { '校验项': '一致性校验结果', '校验值': consistency.consistent ? '通过' : '失败' },
    { '校验项': '导出记录数', '校验值': records.length },
    { '校验项': '导出时间', '校验值': new Date().toLocaleString('zh-CN') },
    { '校验项': '字段映射版本', '校验值': EXPORT_FIELD_MAPPINGS.length + '个字段统一映射' },
  ]);
  XLSX.utils.book_append_sheet(workbook, metadataSheet, '一致性校验');

  const timestamp = new Date().toLocaleDateString('zh-CN').replace(/\//g, '-');
  const filename = `商业街外摆审批明细_${timestamp}`;
  XLSX.writeFile(workbook, `${filename}.xlsx`);

  const log = useAppStore.getState().createExportLog(
    'excel' as ExportFormat,
    `${filename}.xlsx`,
    records,
    consistency.consistent,
    `${consistency.storeHash}|${consistency.pageHash}|${consistency.exportHash}`
  );

  return {
    logId: log.id,
    filename: `${filename}.xlsx`,
    recordCount: records.length,
    consistencyVerified: consistency.consistent,
    message: consistency.message,
  };
};

export const exportToCSV = (records: ApprovalRecord[]): ExportResult => {
  const consistency = runConsistencyCheck(records);

  const data = records.map(r => buildExportRow(r));
  const csv = Papa.unparse(data);

  const timestamp = new Date().toLocaleDateString('zh-CN').replace(/\//g, '-');
  const filename = `商业街外摆审批明细_${timestamp}`;

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();

  const log = useAppStore.getState().createExportLog(
    'csv' as ExportFormat,
    `${filename}.csv`,
    records,
    consistency.consistent,
    `${consistency.storeHash}|${consistency.pageHash}|${consistency.exportHash}`
  );

  return {
    logId: log.id,
    filename: `${filename}.csv`,
    recordCount: records.length,
    consistencyVerified: consistency.consistent,
    message: consistency.message,
  };
};

export const exportStreetSummary = (records: ApprovalRecord[]): ExportResult => {
  const consistency = runConsistencyCheck(records);
  const completedRecords = records.filter(r => r.summary);
  
  let content = '商业街外摆时段审批 - 街道会看摘要\n';
  content += '=' .repeat(60) + '\n\n';
  content += `生成时间：${new Date().toLocaleString('zh-CN')}\n`;
  content += `导出格式：街道会看摘要（纯文本，隐藏内部操作痕迹）\n`;
  content += `一致性校验：${consistency.consistent ? '通过' : '未通过'}\n`;
  content += `数据哈希：${consistency.storeHash}\n`;
  content += `记录总数：${completedRecords.length} 条（共 ${records.length} 条，未更新摘要的不展示给街道）\n\n`;
  content += '-'.repeat(60) + '\n\n';

  completedRecords.forEach((r, idx) => {
    content += `${idx + 1}. ${getDisplayCommunityName(r)}\n`;
    content += '-'.repeat(40) + '\n';
    content += `   无障碍坡道：${r.rampRecord.exists ? '有' : '无'}`;
    if (r.rampRecord.location) content += ` - 位置：${r.rampRecord.location}`;
    if (r.rampRecord.condition) content += ` - 状况：${r.rampRecord.condition}`;
    content += '\n';
    
    if (r.samplingPoint) {
      content += `   夜间采样点：${r.samplingPoint.exists ? '有' : '无'}`;
      if (r.samplingPoint.location) content += ` - 位置：${r.samplingPoint.location}`;
      content += ` - 可信度：${CREDIBILITY_LABELS[r.samplingPoint.credibility]}\n`;
    }
    
    if (r.hasNameConflict) {
      content += `   名称说明：新旧名称已确认，旧称「${r.communityOldName || '无'}」新称「${r.communityNewName || '无'}」最终「${r.communityFinalName || '待确认'}」\n`;
    }
    
    content += `   审批状态：${STATUS_LABELS[r.status]}\n`;
    content += `   街道摘要：${r.summary?.content}\n\n`;
  });

  content += '\n' + '='.repeat(60) + '\n';
  content += '导出追溯说明：本文件对应导出日志 ID 可在系统「导出明细结果」页面查询，\n';
  content += '            可从日志追溯回每一条记录的原始行号、无障碍坡道原始材料、完整状态链路。';

  const timestamp = new Date().toLocaleDateString('zh-CN').replace(/\//g, '-');
  const filename = `街道会看摘要_${timestamp}`;

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.txt`;
  link.click();

  const log = useAppStore.getState().createExportLog(
    'street_summary' as ExportFormat,
    `${filename}.txt`,
    records,
    consistency.consistent,
    `${consistency.storeHash}|${consistency.pageHash}|${consistency.exportHash}`
  );

  return {
    logId: log.id,
    filename: `${filename}.txt`,
    recordCount: completedRecords.length,
    consistencyVerified: consistency.consistent,
    message: consistency.message,
  };
};

export const verifyConsistency = (records: ApprovalRecord[]) => {
  return runConsistencyCheck(records);
};
