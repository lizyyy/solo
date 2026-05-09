import dayjs from 'dayjs';

export const formatDate = (date: string | Date | undefined, format = 'YYYY-MM-DD HH:mm:ss') => {
  if (!date) return '-';
  return dayjs(date).format(format);
};

export const formatDateOnly = (date: string | Date | undefined) => {
  return formatDate(date, 'YYYY-MM-DD');
};

export const formatCurrency = (value: number | undefined, decimals = 2) => {
  if (value === undefined || value === null) return '-';
  return `¥${Number(value).toFixed(decimals)}`;
};

export const formatNumber = (value: number | undefined, decimals = 0) => {
  if (value === undefined || value === null) return '-';
  return Number(value).toLocaleString('zh-CN', { maximumFractionDigits: decimals });
};

export const getOperationTypeLabel = (type: string) => {
  const map: Record<string, string> = {
    IN: '入库',
    OUT: '出库',
    ADJUST: '调整',
    PRICE_CHANGE: '改价',
    TRANSFER_IN: '调拨入',
    TRANSFER_OUT: '调拨出',
  };
  return map[type] || type;
};

export const getTransferStatusLabel = (status: string) => {
  const map: Record<string, { label: string; type: string }> = {
    PENDING: { label: '待处理', type: 'info' },
    IN_PROGRESS: { label: '进行中', type: 'warning' },
    COMPLETED: { label: '已完成', type: 'success' },
    CANCELLED: { label: '已取消', type: 'info' },
    REVERTED: { label: '已回退', type: 'warning' },
    FAILED: { label: '失败', type: 'danger' },
  };
  return map[status] || { label: status, type: 'info' };
};

export const getTaskStatusLabel = (status: string) => {
  const map: Record<string, { label: string; type: string }> = {
    PENDING: { label: '待处理', type: 'info' },
    PROCESSING: { label: '处理中', type: 'warning' },
    COMPLETED: { label: '已完成', type: 'success' },
    FAILED: { label: '失败', type: 'danger' },
    CANCELLED: { label: '已取消', type: 'info' },
    RETRY: { label: '重试中', type: 'warning' },
  };
  return map[status] || { label: status, type: 'info' };
};

export const getAuditOperationLabel = (operation: string) => {
  const map: Record<string, string> = {
    CREATE: '创建',
    UPDATE: '更新',
    DELETE: '删除',
    TRANSFER: '调拨',
    PRICE_CHANGE: '改价',
    ADJUST: '调整',
    REVERT: '回滚',
    BATCH: '批量',
    EXPORT: '导出',
  };
  return map[operation] || operation;
};

export const getAuditEntityLabel = (entity: string) => {
  const map: Record<string, string> = {
    USER: '用户',
    STORE: '门店',
    PRODUCT: '商品',
    INVENTORY: '库存',
    INVENTORY_RECORD: '库存记录',
    PRICE: '价格',
    TRANSFER_ORDER: '调拨单',
  };
  return map[entity] || entity;
};
