import type { ReservationStatus } from './types';

export function getStatusLabel(status: ReservationStatus): string {
  const labels: Record<ReservationStatus, string> = {
    draft: '草稿',
    pending: '待审批',
    approved: '已批准',
    rejected: '已拒绝',
    cancelled: '已取消',
    completed: '已完成'
  };
  return labels[status];
}

export function getStatusColor(status: ReservationStatus): string {
  switch (status) {
    case 'approved': return 'bg-green-100 text-green-800';
    case 'pending': return 'bg-yellow-100 text-yellow-800';
    case 'rejected': return 'bg-red-100 text-red-800';
    case 'cancelled': return 'bg-gray-100 text-gray-800';
    case 'completed': return 'bg-blue-100 text-blue-800';
    default: return 'bg-blue-100 text-blue-800';
  }
}

export function getAccessoryTypeLabel(type: string): string {
  switch (type) {
    case 'magnification': return '倍率模块';
    case 'sample_stage': return '样品台';
    default: return '其他附件';
  }
}

export function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    create: '创建预约',
    update: '修改预约',
    submit: '提交审批',
    approve: '批准预约',
    reject: '拒绝预约',
    cancel: '取消预约',
    delete: '删除预约'
  };
  return labels[action] || action;
}
