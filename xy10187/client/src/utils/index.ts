import dayjs from 'dayjs';
import { ReceiptStatus, SettlementStatus, AppealStatus } from '../types';

export const RECEIPT_STATUS_MAP: Record<ReceiptStatus, { text: string; color: string }> = {
  pending: { text: '待审核', color: 'gold' },
  approved: { text: '已通过', color: 'green' },
  rejected: { text: '已拒绝', color: 'red' },
  duplicate: { text: '重复小票', color: 'orange' },
  settled: { text: '已结算', color: 'blue' },
  appealed: { text: '申诉中', color: 'purple' }
};

export const SETTLEMENT_STATUS_MAP: Record<SettlementStatus, { text: string; color: string }> = {
  pending: { text: '待处理', color: 'gold' },
  processing: { text: '处理中', color: 'blue' },
  completed: { text: '已完成', color: 'green' },
  cancelled: { text: '已取消', color: 'red' }
};

export const APPEAL_STATUS_MAP: Record<AppealStatus, { text: string; color: string }> = {
  pending: { text: '待处理', color: 'gold' },
  resolved: { text: '已解决', color: 'green' },
  rejected: { text: '已驳回', color: 'red' }
};

export const APPEAL_TYPE_MAP: Record<string, { text: string; color: string }> = {
  reject: { text: '拒绝申诉', color: 'red' },
  duplicate: { text: '重复申诉', color: 'orange' }
};

export function formatDateTime(value: string): string {
  if (!value) return '-';
  return dayjs(value).format('YYYY-MM-DD HH:mm:ss');
}

export function formatDate(value: string): string {
  if (!value) return '-';
  return dayjs(value).format('YYYY-MM-DD');
}

export function formatMoney(value: number): string {
  if (value === undefined || value === null) return '-';
  return `¥${value.toFixed(2)}`;
}

export function getReceiptStatusTag(status: ReceiptStatus) {
  return RECEIPT_STATUS_MAP[status] || { text: status, color: 'default' };
}

export function getSettlementStatusTag(status: SettlementStatus) {
  return SETTLEMENT_STATUS_MAP[status] || { text: status, color: 'default' };
}

export function getAppealStatusTag(status: AppealStatus) {
  return APPEAL_STATUS_MAP[status] || { text: status, color: 'default' };
}

export function getAppealTypeTag(type: string) {
  return APPEAL_TYPE_MAP[type] || { text: type, color: 'default' };
}

export function buildQueryString(params: Record<string, any>): string {
  const filtered = Object.entries(params).filter(([_, value]) => value !== undefined && value !== null && value !== '');
  if (filtered.length === 0) return '';
  return '?' + filtered.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&');
}

export function downloadFile(url: string, filename?: string) {
  const link = document.createElement('a');
  link.href = url;
  if (filename) {
    link.download = filename;
  }
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
