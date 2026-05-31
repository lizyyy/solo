import { DisplayTask, AnomalyType, ExportValidationResult, ExportSpec, DisplayItem } from '../types';

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 11);
};

export const formatDate = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    draft: '草稿',
    pending: '待确认',
    confirmed: '已确认',
    exported: '已导出',
    withdrawn: '已撤回',
    archived: '已归档',
  };
  return labels[status] || status;
};

export const getAnomalyLabel = (type: AnomalyType): string => {
  const labels: Record<AnomalyType, string> = {
    color_mismatch: '颜色版本混用',
    spec_mismatch: '导出规格漏改',
    auth_expired: '授权过期',
    duplicate_import: '重复导入',
    filter_inconsistent: '筛选口径不一致',
  };
  return labels[type];
};

export const getDepartmentLabel = (dept: string): string => {
  const labels: Record<string, string> = {
    design: '设计部',
    marketing: '市场部',
    printing: '印刷供应商',
  };
  return labels[dept] || dept;
};

export const getSeverityColor = (severity: string): string => {
  const colors: Record<string, string> = {
    warning: '#f59e0b',
    error: '#ef4444',
    critical: '#dc2626',
  };
  return colors[severity] || '#6b7280';
};

export const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    draft: '#6b7280',
    pending: '#f59e0b',
    confirmed: '#10b981',
    exported: '#3b82f6',
    withdrawn: '#ef4444',
    archived: '#9ca3af',
  };
  return colors[status] || '#6b7280';
};

export const validateExportConsistency = (
  task: DisplayTask,
  specs: ExportSpec[],
  allTasks: DisplayTask[]
): ExportValidationResult => {
  const issues: ExportValidationResult['issues'] = [];
  const currentSpec = specs.find(s => s.id === task.exportSpecId);
  
  const colorVersions = new Set(task.items.map(item => item.colorVersion));
  if (colorVersions.size > 1) {
    issues.push({
      type: 'color_mismatch',
      message: `检测到 ${colorVersions.size} 种颜色版本混用: ${Array.from(colorVersions).join(', ')}`,
      affectedItems: task.items.filter(i => colorVersions.has(i.colorVersion)).map(i => i.sku),
    });
  }

  const activeSpec = specs.find(s => s.isActive);
  if (currentSpec && activeSpec && currentSpec.id !== activeSpec.id) {
    issues.push({
      type: 'spec_mismatch',
      message: `使用的导出规格(v${currentSpec.version})不是最新版本(v${activeSpec.version})`,
      affectedItems: task.items.map(i => i.sku),
    });
  }

  const duplicateItems = task.items.filter(item => 
    allTasks.some(t => 
      t.id !== task.id && 
      t.status !== 'withdrawn' &&
      t.items.some(i => i.sku === item.sku && t.season === task.season)
    )
  );
  if (duplicateItems.length > 0) {
    issues.push({
      type: 'duplicate_import',
      message: `发现 ${duplicateItems.length} 个商品在同季其他任务中存在`,
      affectedItems: duplicateItems.map(i => i.sku),
    });
  }

  const errorCount = issues.filter(i => 
    ['spec_mismatch', 'auth_expired'].includes(i.type)
  ).length;
  const warningCount = issues.length - errorCount;

  return {
    isValid: issues.length === 0,
    issues,
    summary: {
      totalItems: task.items.length,
      validItems: task.items.length,
      warningCount,
      errorCount,
    },
  };
};

export const createHistoryRecord = (
  taskId: string,
  action: string,
  description: string,
  operator: string
) => ({
  id: generateId(),
  taskId,
  action,
  description,
  operator,
  timestamp: new Date().toISOString(),
});

export const exportToCSV = (items: DisplayItem[], filename: string): void => {
  const headers = ['SKU', '商品名称', '分类', '颜色版本', '数量', '门店范围'];
  const rows = items.map(item => [
    item.sku,
    item.name,
    item.category,
    item.colorVersion,
    item.quantity.toString(),
    item.storeIds.join(';'),
  ]);
  
  const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};
