import { RentalStatus } from '@/types';

export const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

export const formatCurrency = (amount: number): string => {
  return `¥${amount.toFixed(2)}`;
};

export const getStatusColor = (status: RentalStatus): string => {
  const colors: Record<RentalStatus, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-blue-100 text-blue-800',
    picked_up: 'bg-green-100 text-green-800',
    returned: 'bg-purple-100 text-purple-800',
    cleaning: 'bg-orange-100 text-orange-800',
    completed: 'bg-gray-100 text-gray-800',
    damaged: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-200 text-gray-500',
    blocked: 'bg-red-200 text-red-900',
  };
  return colors[status];
};

export const getStatusLabel = (status: RentalStatus): string => {
  const labels: Record<RentalStatus, string> = {
    pending: '待处理',
    confirmed: '已确认',
    picked_up: '已取走',
    returned: '已归还',
    cleaning: '清洁中',
    completed: '已完成',
    damaged: '待赔付',
    cancelled: '已取消',
    blocked: '已拦截',
  };
  return labels[status];
};

export const calculateDays = (startDate: string, endDate: string): number => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diff = end.getTime() - start.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
};

export const exportToCSV = (data: any[], filename: string) => {
  if (data.length === 0) return;
  
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(h => `"${row[h] || ''}"`).join(','))
  ].join('\n');
  
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
};
