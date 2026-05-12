export const statusLabels: Record<string, string> = {
  pending: '待处理',
  in_progress: '进行中',
  passed: '已通过',
  failed: '失败',
  open: '开放',
  closed: '已关闭',
  confirmed: '已确认',
  retry: '待重试',
  business_decision: '需业务决定'
};

export const statusColors: Record<string, string> = {
  pending: 'warning',
  in_progress: 'info',
  passed: 'success',
  failed: 'danger',
  open: 'secondary',
  closed: 'success',
  confirmed: 'success',
  retry: 'info',
  business_decision: 'danger'
};

export const diffTypeLabels: Record<string, string> = {
  data: '数据量',
  permission: '权限',
  task: '定时任务',
  callback: '回调地址'
};

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}
