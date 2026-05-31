import { DataType, OperationAction } from '@/types';

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 11);
};

export const getCurrentTimestamp = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

export const getDateString = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const generateProcessingRule = (
  action: OperationAction,
  dataType: DataType,
  detail?: string
): string => {
  const dateStr = getDateString();
  const actionMap: Record<OperationAction, string> = {
    import: '导入',
    edit: '人工修改',
    undo: '撤回',
    export: '导出',
    status_change: '状态变更',
    skip: '跳过',
  };
  const typeMap: Record<DataType, string> = {
    script: '演示脚本',
    part: '零件清单',
    note: '备注',
    knowledge: '知识点',
  };
  const base = `${dateStr} ${actionMap[action]}${typeMap[dataType]}`;
  return detail ? `${base}：${detail}` : base;
};

export const generateVersion = (existingVersion?: string): string => {
  if (!existingVersion) return '1.0';
  const parts = existingVersion.split('.');
  const major = parseInt(parts[0] || '1', 10);
  const minor = parseInt(parts[1] || '0', 10);
  return `${major}.${minor + 1}`;
};

export const getOperator = (): string => {
  return localStorage.getItem('operator') || '培训老师';
};

export const setOperator = (name: string): void => {
  localStorage.setItem('operator', name);
};

export const generateExportFilename = (filters: { status?: string; dateFrom?: string; dateTo?: string }): string => {
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const statusMap: Record<string, string> = {
    confirmed: '已确认',
    pending: '待补',
    modified: '人工修改',
    all: '全部',
  };
  const statusPart = filters.status ? `_${statusMap[filters.status] || filters.status}` : '';
  return `课堂记录${statusPart}_${dateStr}_${timeStr}.csv`;
};

export const statusToText = (status: string): string => {
  const map: Record<string, string> = {
    confirmed: '已确认',
    pending: '待补',
    modified: '人工修改',
  };
  return map[status] || status;
};

export const actionToText = (action: string): string => {
  const map: Record<string, string> = {
    import: '导入',
    edit: '编辑',
    undo: '撤回',
    export: '导出',
    status_change: '状态变更',
    skip: '跳过',
  };
  return map[action] || action;
};

export const dataTypeToText = (type: string): string => {
  const map: Record<string, string> = {
    script: '演示脚本',
    part: '零件清单',
    note: '备注',
    knowledge: '知识点',
  };
  return map[type] || type;
};

export const highlightText = (text: string, keywords: string[]): string => {
  let result = text;
  keywords.forEach((keyword) => {
    if (keyword.trim()) {
      const regex = new RegExp(`(${keyword})`, 'gi');
      result = result.replace(regex, '<mark class="bg-star-gold/30 px-1 rounded">$1</mark>');
    }
  });
  return result;
};
