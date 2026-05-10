import type { CaseStatus, PaymentStatus, EvidenceType } from '../types';

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 11).toUpperCase();
};

export const formatDateTime = (date: string): string => {
  return new Date(date).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatCurrency = (amount: number): string => {
  return `¥${amount.toFixed(2)}`;
};

export const getStatusLabel = (status: CaseStatus): string => {
  const labels: Record<CaseStatus, string> = {
    pending_review: '待复核',
    approved: '已通过',
    rejected: '已拒绝',
    payment_pending: '待补缴',
    payment_completed: '补缴完成',
    exported: '已导出',
  };
  return labels[status];
};

export const getStatusColor = (status: CaseStatus): string => {
  const colors: Record<CaseStatus, string> = {
    pending_review: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    payment_pending: 'bg-orange-100 text-orange-800',
    payment_completed: 'bg-blue-100 text-blue-800',
    exported: 'bg-gray-100 text-gray-800',
  };
  return colors[status];
};

export const getPaymentStatusLabel = (status: PaymentStatus): string => {
  const labels: Record<PaymentStatus, string> = {
    unpaid: '未缴费',
    partial: '部分缴费',
    paid: '已缴费',
  };
  return labels[status];
};

export const getEvidenceTypeLabel = (type: EvidenceType): string => {
  const labels: Record<EvidenceType, string> = {
    entry_image: '入场图片',
    exit_record: '出场记录',
    manual_release: '人工放行',
    payment_proof: '补缴凭证',
    other: '其他',
  };
  return labels[type];
};
