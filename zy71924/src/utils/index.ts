import { RecordStatus, RecordSource } from '../types';

export const getStatusLabel = (status: RecordStatus): string => {
  const labels: Record<RecordStatus, string> = {
    normal: '正常',
    pending: '待处理',
    abnormal: '异常'
  };
  return labels[status];
};

export const getStatusColor = (status: RecordStatus): string => {
  const colors: Record<RecordStatus, string> = {
    normal: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    pending: 'bg-amber-100 text-amber-700 border-amber-200',
    abnormal: 'bg-red-100 text-red-700 border-red-200'
  };
  return colors[status];
};

export const getStatusDotColor = (status: RecordStatus): string => {
  const colors: Record<RecordStatus, string> = {
    normal: 'bg-emerald-500',
    pending: 'bg-amber-500',
    abnormal: 'bg-red-500'
  };
  return colors[status];
};

export const getSourceLabel = (source: RecordSource): string => {
  const labels: Record<RecordSource, string> = {
    first_entry: '首次录入',
    re_entry: '二次进场',
    manual: '人工创建'
  };
  return labels[source];
};

export const getSourceBadgeColor = (source: RecordSource): string => {
  const colors: Record<RecordSource, string> = {
    first_entry: 'bg-slate-100 text-slate-600',
    re_entry: 'bg-sky-100 text-sky-700',
    manual: 'bg-violet-100 text-violet-700'
  };
  return colors[source];
};

export const formatDate = (dateStr: string): string => {
  return dateStr;
};

export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const exportToExcel = (data: any[], filename: string) => {
  import('xlsx').then(XLSX => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    XLSX.writeFile(workbook, `${filename}.xlsx`);
  });
};
