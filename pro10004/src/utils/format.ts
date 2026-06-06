export const formatCurrency = (amount: number, currency: string): string => {
  const formatted = amount.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `${currency} ${formatted}`;
};

export const formatDate = (dateStr: string): string => {
  return dateStr;
};

export const formatDateTime = (datetimeStr: string): string => {
  return datetimeStr;
};

export const getStatusLabel = (status: string): string => {
  const statusMap: Record<string, string> = {
    normal: '正常',
    abnormal: '异常',
    pending: '待确认'
  };
  return statusMap[status] || status;
};

export const getDiffTypeLabel = (diffType: string): string => {
  const diffMap: Record<string, string> = {
    added: '新增',
    removed: '删除',
    modified: '字段修改',
    status_changed: '状态变更'
  };
  return diffMap[diffType] || diffType;
};
