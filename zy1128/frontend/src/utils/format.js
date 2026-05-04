export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return '-';
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

export const formatPercentage = (rate) => {
  if (rate === null || rate === undefined) return '-';
  return `${(rate * 100).toFixed(2)}%`;
};

export const formatDate = (date) => {
  if (!date) return '-';
  try {
    return new Date(date).toLocaleDateString('zh-CN');
  } catch {
    return date;
  }
};

export const getStatusLabel = (status) => {
  const labels = {
    matched: '已匹配',
    unmatched: '未到账',
    underpaid: '少到账',
    overpaid: '多到账',
    pending: '待处理',
    manual: '手工调整',
    active: '持有中',
    matured: '已到期',
    redeemed: '已赎回',
    terminated: '已终止'
  };
  return labels[status] || status;
};

export const getStatusBadgeClass = (status) => {
  const classes = {
    matched: 'status-badge-matched',
    unmatched: 'status-badge-unmatched',
    underpaid: 'status-badge-underpaid',
    overpaid: 'status-badge-overpaid',
    pending: 'status-badge-pending',
    manual: 'status-badge-manual',
    active: 'status-badge-matched',
    matured: 'status-badge-pending',
    redeemed: 'status-badge-pending',
    terminated: 'status-badge-unmatched'
  };
  return classes[status] || 'status-badge-pending';
};

export const getProductTypeLabel = (type) => {
  const labels = {
    bank_wealth: '银行理财',
    money_market: '货币基金',
    broker_cash: '券商现金管理'
  };
  return labels[type] || type;
};

export const getTransactionTypeLabel = (type) => {
  const labels = {
    income: '收入',
    expense: '支出',
    transfer: '转账',
    principal_return: '本金返还',
    interest: '利息',
    fee: '费用'
  };
  return labels[type] || type;
};

export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
