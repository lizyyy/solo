import type { OrderStatus, TransactionType, TransactionStatus, ExceptionType, ExceptionStatus } from './types';

export const formatCurrency = (amount: number, currency: string = 'CNY'): string => {
  if (currency === 'CNY') {
    return `¥${amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
  };
  return `${symbols[currency] || currency}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const formatPercent = (value: number): string => {
  return `${(value * 100).toFixed(1)}%`;
};

export const getOrderStatusLabel = (status: OrderStatus): string => {
  const labels: Record<OrderStatus, string> = {
    pending: '待确认',
    confirmed: '已确认',
    shipped: '已发货',
    delivered: '已完成',
    defaulted: '已违约',
    cancelled: '已取消',
  };
  return labels[status];
};

export const getOrderStatusColor = (status: OrderStatus): string => {
  const colors: Record<OrderStatus, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-blue-100 text-blue-800',
    shipped: 'bg-purple-100 text-purple-800',
    delivered: 'bg-green-100 text-green-800',
    defaulted: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-100 text-gray-800',
  };
  return colors[status];
};

export const getTransactionTypeLabel = (type: TransactionType): string => {
  const labels: Record<TransactionType, string> = {
    sale: '销售收入',
    purchase: '采购支出',
    forex_exchange: '外汇兑换',
    inventory_cost: '库存成本',
    refund: '退款',
    correction: '人工修正',
  };
  return labels[type];
};

export const getTransactionStatusLabel = (status: TransactionStatus): string => {
  const labels: Record<TransactionStatus, string> = {
    normal: '正常',
    supplement: '补录',
    reversed: '已撤回',
    duplicate: '重复',
    pending_review: '待审核',
  };
  return labels[status];
};

export const getTransactionStatusColor = (status: TransactionStatus): string => {
  const colors: Record<TransactionStatus, string> = {
    normal: 'bg-green-100 text-green-800',
    supplement: 'bg-orange-100 text-orange-800',
    reversed: 'bg-gray-100 text-gray-800',
    duplicate: 'bg-yellow-100 text-yellow-800',
    pending_review: 'bg-red-100 text-red-800',
  };
  return colors[status];
};

export const getExceptionTypeLabel = (type: ExceptionType): string => {
  const labels: Record<ExceptionType, string> = {
    forex_loss: '汇率亏损',
    inventory_overstock: '库存积压',
    customer_default: '客户违约',
    missing_fields: '字段缺失',
    late_submission: '延迟提交',
  };
  return labels[type];
};

export const getExceptionTypeIcon = (type: ExceptionType): string => {
  const icons: Record<ExceptionType, string> = {
    forex_loss: 'TrendingDown',
    inventory_overstock: 'Package',
    customer_default: 'UserX',
    missing_fields: 'FileX',
    late_submission: 'Clock',
  };
  return icons[type];
};

export const getExceptionStatusLabel = (status: ExceptionStatus): string => {
  const labels: Record<ExceptionStatus, string> = {
    pending: '待处理',
    confirmed: '已确认',
    waived: '已豁免',
    resolved: '已解决',
  };
  return labels[status];
};

export const getExceptionStatusColor = (status: ExceptionStatus): string => {
  const colors: Record<ExceptionStatus, string> = {
    pending: 'bg-red-100 text-red-800',
    confirmed: 'bg-orange-100 text-orange-800',
    waived: 'bg-blue-100 text-blue-800',
    resolved: 'bg-green-100 text-green-800',
  };
  return colors[status];
};

export const getTrendIcon = (trend: 'up' | 'down' | 'stable'): string => {
  const icons = {
    up: 'TrendingUp',
    down: 'TrendingDown',
    stable: 'Minus',
  };
  return icons[trend];
};

export const getTrendColor = (trend: 'up' | 'down' | 'stable'): string => {
  const colors = {
    up: 'text-green-600',
    down: 'text-red-600',
    stable: 'text-gray-600',
  };
  return colors[trend];
};

export const getCardTypeLabel = (cardType: 'normal' | 'shock' | 'recovery'): string => {
  const labels = {
    normal: '正常波动',
    shock: '风险冲击',
    recovery: '政策修复',
  };
  return labels[cardType];
};

export const getCardTypeColor = (cardType: 'normal' | 'shock' | 'recovery'): string => {
  const colors = {
    normal: 'border-blue-500 bg-blue-50',
    shock: 'border-red-500 bg-red-50',
    recovery: 'border-green-500 bg-green-50',
  };
  return colors[cardType];
};

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 11);
};

export const formatDate = (date: Date): string => {
  return new Date(date).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

export const getRiskColor = (risk: 'low' | 'medium' | 'high'): string => {
  const colors = {
    low: 'bg-green-500',
    medium: 'bg-yellow-500',
    high: 'bg-red-500',
  };
  return colors[risk];
};

export const getRiskLabel = (risk: 'low' | 'medium' | 'high'): string => {
  const labels = {
    low: '低风险',
    medium: '中风险',
    high: '高风险',
  };
  return labels[risk];
};
