import { StatusType, OfflineReason, SourceType, TaskStatus } from '../types';

export const statusDesc: Record<StatusType, string> = {
  [StatusType.ONLINE]: '上架中',
  [StatusType.OFFLINE]: '已下架',
  [StatusType.SUSPENDED]: '临时停售'
};

export const reasonDesc: Record<OfflineReason, string> = {
  [OfflineReason.OUT_OF_STOCK]: '缺货',
  [OfflineReason.ACTIVITY_END]: '活动结束',
  [OfflineReason.COMPLIANCE]: '合规限制',
  [OfflineReason.MANUAL]: '人工操作'
};

export const sourceDesc: Record<SourceType, string> = {
  [SourceType.AUTO]: '系统自动',
  [SourceType.MANUAL]: '人工操作'
};

export const taskStatusDesc: Record<TaskStatus, string> = {
  [TaskStatus.PENDING]: '待执行',
  [TaskStatus.RUNNING]: '执行中',
  [TaskStatus.COMPLETED]: '已完成',
  [TaskStatus.FAILED]: '执行失败',
  [TaskStatus.CANCELLED]: '已取消'
};

export const formatBusinessTime = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

export const generateId = (prefix: string): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}`;
};

export const now = (): string => new Date().toISOString();

export const successResponse = <T>(message: string, data?: T) => ({
  success: true,
  code: '0000',
  message,
  data,
  timestamp: now()
});

export const errorResponse = (code: string, message: string) => ({
  success: false,
  code,
  message,
  timestamp: now()
});
