import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export const formatMoney = (amount: number): string => {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const formatDateTime = (dateString: string): string => {
  return format(new Date(dateString), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN });
};

export const formatDate = (dateString: string): string => {
  return format(new Date(dateString), 'yyyy-MM-dd', { locale: zhCN });
};

export const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    pending: '待处理',
    processing: '处理中',
    approved: '已通过',
    rejected: '已拒绝',
    to_confirm: '待确认',
    success: '成功',
    failed: '失败',
    active: '生效中',
    expired: '已过期',
  };
  return labels[status] || status;
};

export const getRiskLevelLabel = (level: string): string => {
  const labels: Record<string, string> = {
    low: '低风险',
    medium: '中风险',
    high: '高风险',
    critical: '极高风险',
  };
  return labels[level] || level;
};

export const getRiskTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    whitelist_expired: '白名单过期',
    limit_exceeded: '限额超限',
    duplicate_transaction: '重复交易',
    calculation_missing: '计算漏算',
    other: '其他风险',
  };
  return labels[type] || type;
};

export const generateContentHash = (content: string): string => {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(12, '0');
};
