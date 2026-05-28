import { RedemptionStatus, BatchStatus, DisputeStatus } from '../types';

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

export function formatCurrency(amount: number): string {
  return amount.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function maskIdNumber(idNumber: string): string {
  if (idNumber.length <= 8) return idNumber;
  return idNumber.slice(0, 3) + '*'.repeat(idNumber.length - 7) + idNumber.slice(-4);
}

export function maskPhone(phone: string): string {
  if (phone.length !== 11) return phone;
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}

export function getStatusColor(status: RedemptionStatus): string {
  const colorMap: Record<RedemptionStatus, string> = {
    pending: 'default',
    processing: 'processing',
    completed: 'success',
    frozen: 'warning',
    disputed: 'error',
    cancelled: 'default'
  };
  return colorMap[status] || 'default';
}

export function getStatusText(status: RedemptionStatus): string {
  const textMap: Record<RedemptionStatus, string> = {
    pending: '待处理',
    processing: '处理中',
    completed: '已完成',
    frozen: '已冻结',
    disputed: '有争议',
    cancelled: '已取消'
  };
  return textMap[status] || status;
}

export function getBatchStatusColor(status: BatchStatus): string {
  const colorMap: Record<BatchStatus, string> = {
    draft: 'default',
    approved: 'processing',
    executing: 'processing',
    completed: 'success'
  };
  return colorMap[status] || 'default';
}

export function getBatchStatusText(status: BatchStatus): string {
  const textMap: Record<BatchStatus, string> = {
    draft: '草稿',
    approved: '已审核',
    executing: '执行中',
    completed: '已完成'
  };
  return textMap[status] || status;
}

export function getDisputeStatusColor(status: DisputeStatus): string {
  const colorMap: Record<DisputeStatus, string> = {
    open: 'error',
    resolved: 'success',
    closed: 'default'
  };
  return colorMap[status] || 'default';
}

export function getDisputeStatusText(status: DisputeStatus): string {
  const textMap: Record<DisputeStatus, string> = {
    open: '待处理',
    resolved: '已解决',
    closed: '已关闭'
  };
  return textMap[status] || status;
}

export function getOperationTypeText(type: string): string {
  const textMap: Record<string, string> = {
    create: '新建',
    update: '更新',
    freeze: '冻结',
    unfreeze: '解冻',
    dispute: '标记争议',
    batch_assign: '分配批次'
  };
  return textMap[type] || type;
}

export function hasCriticalError(codes: string[]): boolean {
  return codes.includes('NEGATIVE_BALANCE') || codes.includes('DUPLICATE_REGISTRATION');
}

export function getSeverityColor(severity: string): string {
  const colorMap: Record<string, string> = {
    error: '#F53F3F',
    warning: '#FF7D00',
    info: '#165DFF'
  };
  return colorMap[severity] || '#86909C';
}
