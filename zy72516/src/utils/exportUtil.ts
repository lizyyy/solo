import Papa from 'papaparse';
import { AnnotationRecord, StatusLabelMap, AbnormalTypeLabelMap } from '../types';

export interface ExportField {
  key: string;
  label: string;
  getValue: (record: AnnotationRecord) => string | number | boolean;
}

export const defaultExportFields: ExportField[] = [
  { key: 'originalLineNumber', label: '原始行号', getValue: (r) => r.originalLineNumber },
  { key: 'annotatorMessage', label: '标注员留言', getValue: (r) => r.annotatorMessage },
  { key: 'referenceUrl', label: '引用链接', getValue: (r) => r.referenceUrl },
  { key: 'urlStatus', label: '链接状态', getValue: (r) => r.urlStatus ? '有效' : '无效(404)' },
  { key: 'robotJudgment', label: '机器人判断', getValue: (r) => r.robotJudgment },
  { key: 'currentStatus', label: '当前处理状态', getValue: (r) => StatusLabelMap[r.currentStatus] },
  { key: 'abnormalType', label: '异常类型', getValue: (r) => AbnormalTypeLabelMap[r.abnormalType] },
  { key: 'lastOperator', label: '最后操作人', getValue: (r) => r.lastOperator || '-' },
  { key: 'updatedAt', label: '更新时间', getValue: (r) => new Date(r.updatedAt).toLocaleString('zh-CN') },
  { key: 'createdAt', label: '导入时间', getValue: (r) => new Date(r.createdAt).toLocaleString('zh-CN') }
];

export function exportToCsv(
  records: AnnotationRecord[],
  fields: ExportField[] = defaultExportFields,
  filename: string = '售后机器人转人工判断明细.csv'
): void {
  const rows = records.map(record => {
    const row: Record<string, string | number | boolean> = {};
    fields.forEach(field => {
      row[field.label] = field.getValue(record);
    });
    return row;
  });

  const csv = Papa.unparse(rows);
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToJson(
  records: AnnotationRecord[],
  filename: string = '售后机器人转人工判断明细.json'
): void {
  const json = JSON.stringify(records, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function getExportPreview(
  records: AnnotationRecord[],
  fields: ExportField[] = defaultExportFields,
  limit: number = 5
): Record<string, string | number | boolean>[] {
  return records.slice(0, limit).map(record => {
    const row: Record<string, string | number | boolean> = {};
    fields.forEach(field => {
      row[field.label] = field.getValue(record);
    });
    return row;
  });
}
