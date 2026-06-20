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

export type FieldComparison = {
  fieldCode: string;
  fieldLabel: string;
  storeValue: string | number;
  pageValue: string | number;
  exportValue: string | number;
  matches: boolean;
};

export type RecordComparison = {
  recordId: string;
  originalLineNumber: number;
  displayName: string;
  allMatch: boolean;
  mismatchedFieldLabels: string[];
  mismatchedCount: number;
  fields: FieldComparison[];
};

export type ConsistencyReport = {
  consistent: boolean;
  fieldCount: number;
  recordCount: number;
  matchedRecordCount: number;
  totalMismatches: number;
  storeHash: string;
  pageHash: string;
  exportHash: string;
  summary: string;
  records: RecordComparison[];
  mismatchedRecords: RecordComparison[];
};

const buildExportRow = (record: ApprovalRecord): Record<string, string | number> => {
  const row: Record<string, string | number> = {};
  EXPORT_FIELD_MAPPINGS.forEach((mapping) => {
    row[mapping.label] = formatValueByCode(record, mapping.code);
  });
  return row;
};

const buildFieldMapFromRowLabel = (labelRow: Record<string, string | number>): Map<string, string | number> => {
  const out = new Map<string, string | number>();
  EXPORT_FIELD_MAPPINGS.forEach((m) => {
    out.set(m.code, labelRow[m.label] ?? '');
  });
  return out;
};

const calculateLocalHash = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
};

export const runConsistencyCheck = (records: ApprovalRecord[]): ConsistencyReport => {
  const exportRows = records.map(r => buildExportRow(r));

  const storeRecords = useAppStore.getState().records;
  const storeMap = new Map(storeRecords.map(r => [r.id, r] as const));

  const recordsComparison: RecordComparison[] = records.map((pageRecord) => {
    const storeRecord = storeMap.get(pageRecord.id);
    const idx = records.findIndex(r => r.id === pageRecord.id);
    const exportRow = exportRows[idx] || {};
    const exportFieldMap = buildFieldMapFromRowLabel(exportRow);

    const fields: FieldComparison[] = EXPORT_FIELD_MAPPINGS.map((mapping) => {
      const storeValue = storeRecord ? formatValueByCode(storeRecord, mapping.code) : '';
      const pageValue = formatValueByCode(pageRecord, mapping.code);
      const exportValue = exportFieldMap.get(mapping.code) ?? '';

      const a = String(storeValue);
      const b = String(pageValue);
      const c = String(exportValue);
      const matches = a === b && b === c;

      return {
        fieldCode: mapping.code,
        fieldLabel: mapping.label,
        storeValue,
        pageValue,
        exportValue,
        matches,
      };
    });

    const mismatched = fields.filter(f => !f.matches);

    return {
      recordId: pageRecord.id,
      originalLineNumber: pageRecord.originalLineNumber,
      displayName: getDisplayCommunityName(pageRecord),
      allMatch: mismatched.length === 0,
      mismatchedFieldLabels: mismatched.map(f => f.fieldLabel),
      mismatchedCount: mismatched.length,
      fields,
    };
  });

  const mismatchedRecords = recordsComparison.filter(r => !r.allMatch);
  const totalMismatches = mismatchedRecords.reduce((sum, r) => sum + r.mismatchedCount, 0);

  const storeHash = useAppStore.getState().calculateRecordsHash(storeRecords);
  const pageHash = calculateLocalHash(JSON.stringify(records));
  const exportHash = calculateLocalHash(JSON.stringify(exportRows));

  const consistent = mismatchedRecords.length === 0 && records.length > 0;

  let summary = '';
  if (records.length === 0) {
    summary = '暂无可校验数据，请先导入或导出至少一条记录';
  } else if (consistent) {
    summary = `✅ 三处一致：存储(${records.length}条)、页面展示、导出明细的 ${EXPORT_FIELD_MAPPINGS.length} 个业务字段全部逐字段匹配，无差异`;
  } else {
    summary = `⚠️ 发现差异：${mismatchedRecords.length}/${records.length} 条记录共有 ${totalMismatches} 个字段不一致，请展开下方明细查看具体差异`;
  }

  return {
    consistent,
    fieldCount: EXPORT_FIELD_MAPPINGS.length,
    recordCount: records.length,
    matchedRecordCount: recordsComparison.filter(r => r.allMatch).length,
    totalMismatches,
    storeHash,
    pageHash,
    exportHash,
    summary,
    records: recordsComparison,
    mismatchedRecords,
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

  const metadataRows: Record<string, string | number>[] = [
    { '校验项': '三处一致结论', '校验值': consistency.summary },
    { '校验项': '一致性校验结果', '校验值': consistency.consistent ? '✅ 通过（逐字段匹配）' : '❌ 失败（下方有差异明细）' },
    { '校验项': '参与校验记录数', '校验值': `${consistency.matchedRecordCount}/${consistency.recordCount} 条一致` },
    { '校验项': '业务字段数', '校验值': `${consistency.fieldCount} 个` },
    { '校验项': '不匹配字段数', '校验值': consistency.totalMismatches },
    { '校验项': '数据存储哈希(store)', '校验值': consistency.storeHash },
    { '校验项': '页面渲染哈希(page)', '校验值': consistency.pageHash },
    { '校验项': '导出内容哈希(export)', '校验值': consistency.exportHash },
    { '校验项': '导出时间', '校验值': new Date().toLocaleString('zh-CN') },
  ];

  consistency.mismatchedRecords.forEach((rec) => {
    metadataRows.push({
      '校验项': `【不匹配】${rec.displayName}(行#${rec.originalLineNumber})`,
      '校验值': `不匹配字段：${rec.mismatchedFieldLabels.join('、')}（共${rec.mismatchedCount}个）`,
    });
    rec.mismatchedFieldLabels.forEach((label) => {
      const field = rec.fields.find((f) => f.fieldLabel === label);
      if (field) {
        metadataRows.push({
          '校验项': `  ↳ ${label}`,
          '校验值': `store=[${field.storeValue}] | page=[${field.pageValue}] | export=[${field.exportValue}]`,
        });
      }
    });
  });

  const metadataSheet = XLSX.utils.json_to_sheet(metadataRows);
  metadataSheet['!cols'] = [{ wch: 50 }, { wch: 80 }];
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
    message: consistency.summary,
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
    message: consistency.summary,
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
    message: consistency.summary,
  };
};

export const verifyConsistency = (records: ApprovalRecord[]) => {
  return runConsistencyCheck(records);
};
