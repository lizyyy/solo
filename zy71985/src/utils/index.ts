import * as XLSX from 'xlsx';
import type { InventoryRecord, PermissionChange } from '@/types';

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function generateIdempotentKey(data: Record<string, any>): string {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `IDEMPOTENT-${Math.abs(hash).toString(16).toUpperCase()}`;
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function compareObjects(
  before: Record<string, any>,
  after: Record<string, any>
): Record<string, { before: any; after: any }> {
  const diff: Record<string, { before: any; after: any }> = {};
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);

  keys.forEach(key => {
    const beforeVal = before?.[key];
    const afterVal = after?.[key];
    if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
      diff[key] = { before: beforeVal, after: afterVal };
    }
  });

  return diff;
}

export function parseJsonContent(content: string): Partial<InventoryRecord>[] {
  const data = JSON.parse(content);
  if (Array.isArray(data)) {
    return data;
  }
  return [data];
}

export function parseCsvContent(content: string): Partial<InventoryRecord>[] {
  const lines = content.split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim());
  const records: Partial<InventoryRecord>[] = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = lines[i].split(',').map(v => v.trim());
    const record: Record<string, any> = {};
    headers.forEach((header, idx) => {
      const strVal = values[idx] || '';
      let val: any = strVal;
      if (strVal === 'true') val = true;
      if (strVal === 'false') val = false;
      if (!isNaN(Number(strVal)) && strVal !== '') val = Number(strVal);
      record[header] = val;
    });
    records.push(record);
  }

  return records;
}

export function exportToJson(data: any, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToExcel(records: InventoryRecord[], permissionChanges: PermissionChange[], filename: string): void {
  const wb = XLSX.utils.book_new();

  const recordData = records.map(r => ({
    '库存编码': r.stockCode,
    '接口名称': r.interfaceName,
    '来源': r.source,
    '状态': r.status,
    '预占数量': r.preOccupyQty,
    '已释放数量': r.releaseQty,
    '操作人': r.operator,
    '待处理原因': r.pendingReason || '',
    '幂等键': r.idempotentKey,
    '幂等键有效': r.idempotentValid ? '是' : '否',
    '创建时间': r.createdAt,
    '更新时间': r.updatedAt,
  }));
  const ws1 = XLSX.utils.json_to_sheet(recordData);
  XLSX.utils.book_append_sheet(wb, ws1, '库存记录');

  const permData = permissionChanges.map(p => ({
    '关联记录ID': p.recordId,
    '操作人': p.operator,
    '变更原因': p.changeReason,
    '变更时间': p.createdAt,
    '变更内容': JSON.stringify(p.diffSnapshot),
  }));
  const ws2 = XLSX.utils.json_to_sheet(permData);
  XLSX.utils.book_append_sheet(wb, ws2, '权限变更');

  XLSX.writeFile(wb, filename);
}

export function validateRecord(data: Partial<InventoryRecord>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.interfaceName) {
    errors.push('接口名称不能为空');
  }
  if (!data.stockCode) {
    errors.push('库存编码不能为空');
  }
  if (data.preOccupyQty === undefined || data.preOccupyQty < 0) {
    errors.push('预占数量必须大于等于0');
  }
  if (data.releaseQty === undefined || data.releaseQty < 0) {
    errors.push('已释放数量必须大于等于0');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function calculateCompletionRate(total: number, completed: number): number {
  if (total === 0) return 100;
  return Math.round((completed / total) * 100 * 100) / 100;
}

export function generateSuggestions(records: InventoryRecord[], permissionChanges: PermissionChange[]): string[] {
  const suggestions: string[] = [];
  const pendingCount = records.filter(r => r.status === 'pending').length;
  const errorCount = records.filter(r => r.status === 'error').length;
  const idempotentInvalid = records.filter(r => !r.idempotentValid).length;

  if (pendingCount > 5) {
    suggestions.push(`待处理记录较多(${pendingCount}条)，建议优先处理`);
  }
  if (errorCount > 0) {
    suggestions.push(`存在${errorCount}条异常记录，建议尽快排查处理`);
  }
  if (idempotentInvalid > 0) {
    suggestions.push(`检测到${idempotentInvalid}条幂等键失效记录，请检查接口调用情况`);
  }
  if (permissionChanges.length > 10) {
    suggestions.push(`权限变更记录较多(${permissionChanges.length}条)，建议统一梳理权限规则`);
  }

  const incompleteRelease = records.filter(r => r.releaseQty < r.preOccupyQty && r.status === 'completed');
  if (incompleteRelease.length > 0) {
    suggestions.push(`${incompleteRelease.length}条已完成记录存在未完全释放的库存，请确认`);
  }

  if (suggestions.length === 0) {
    suggestions.push('数据状态良好，各项指标正常');
  }

  return suggestions;
}

export function getTodayDateString(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}
