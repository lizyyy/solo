import type { StallStatus, IssueType, RectificationStatus } from '../types';

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const getStatusColor = (status: StallStatus): string => {
  switch (status) {
    case 'normal':
      return 'bg-green-100 border-green-300 text-green-800';
    case 'has_issue':
      return 'bg-red-100 border-red-300 text-red-800';
    case 'pending_rectification':
      return 'bg-yellow-100 border-yellow-300 text-yellow-800';
    case 'rectified':
      return 'bg-blue-100 border-blue-300 text-blue-800';
    default:
      return 'bg-gray-100 border-gray-300 text-gray-800';
  }
};

export const getStatusText = (status: StallStatus): string => {
  switch (status) {
    case 'normal':
      return '正常';
    case 'has_issue':
      return '有问题';
    case 'pending_rectification':
      return '整改中';
    case 'rectified':
      return '已整改';
    default:
      return '未知';
  }
};

export const getIssueTypeText = (type: IssueType): string => {
  return type === 'oil' ? '油污' : '明火';
};

export const getIssueTypeColor = (type: IssueType): string => {
  return type === 'oil' ? 'bg-amber-100 text-amber-800' : 'bg-orange-100 text-orange-800';
};

export const getRectificationStatusText = (status: RectificationStatus): string => {
  switch (status) {
    case 'pending':
      return '待整改';
    case 'in_progress':
      return '整改中';
    case 'completed':
      return '已完成';
    case 'verified':
      return '已验证';
    default:
      return '未知';
  }
};

export const getRectificationStatusColor = (status: RectificationStatus): string => {
  switch (status) {
    case 'pending':
      return 'bg-red-100 text-red-800';
    case 'in_progress':
      return 'bg-yellow-100 text-yellow-800';
    case 'completed':
      return 'bg-green-100 text-green-800';
    case 'verified':
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export const getSeverityText = (severity: 'low' | 'medium' | 'high'): string => {
  switch (severity) {
    case 'low':
      return '低';
    case 'medium':
      return '中';
    case 'high':
      return '高';
  }
};

export const getSeverityColor = (severity: 'low' | 'medium' | 'high'): string => {
  switch (severity) {
    case 'low':
      return 'bg-green-100 text-green-800';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800';
    case 'high':
      return 'bg-red-100 text-red-800';
  }
};

export const exportToCSV = (data: any[], filename: string) => {
  if (data.length === 0) return;
  
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const cell = row[header];
        const stringified = typeof cell === 'string' ? cell : JSON.stringify(cell);
        return `"${stringified.replace(/"/g, '""')}"`;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const generateId = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};
