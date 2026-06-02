export function formatAmount(amount: number): string {
  if (amount >= 100000000) {
    return `${(amount / 100000000).toFixed(2)}亿`;
  } else if (amount >= 10000) {
    return `${(amount / 10000).toFixed(2)}万`;
  }
  return amount.toFixed(2);
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: '待处理',
    imported: '已导入',
    abnormal: '机构简称异常',
    conflict: '数据冲突',
    resolved: '已处理待复核',
    reviewed: '已复核'
  };
  return labels[status] || status;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-700',
    imported: 'bg-blue-100 text-blue-700',
    abnormal: 'bg-orange-100 text-orange-700',
    conflict: 'bg-red-100 text-red-700',
    resolved: 'bg-yellow-100 text-yellow-700',
    reviewed: 'bg-green-100 text-green-700'
  };
  return colors[status] || 'bg-gray-100 text-gray-700';
}

export function getReviewStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: '待复核',
    approved: '已通过',
    rejected: '已驳回'
  };
  return labels[status] || status;
}

export function getReviewStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700'
  };
  return colors[status] || 'bg-gray-100 text-gray-700';
}

export function getSelfCheckStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pass: 'text-green-500',
    warning: 'text-yellow-500',
    error: 'text-red-500'
  };
  return colors[status] || 'text-gray-500';
}
