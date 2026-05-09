export const STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['processing', 'cancelled'],
  processing: ['shipped', 'failed', 'cancelled'],
  shipped: ['delivered', 'failed'],
  delivered: ['completed'],
  completed: [],
  cancelled: [],
  failed: ['processing', 'cancelled']
};

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: [
    'order.create',
    'order.read',
    'order.update',
    'order.delete',
    'order.export',
    'order.import',
    'order.batch_update',
    'user.create',
    'user.read',
    'user.update',
    'user.delete',
    'log.read',
    'system.recover',
    'system.config'
  ],
  customer_service: [
    'order.create',
    'order.read',
    'order.update',
    'order.export',
    'order.import',
    'order.batch_update',
    'log.read'
  ],
  normal: [
    'order.read',
    'order.export'
  ]
};

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_RETRY_COUNT = 3;
export const RETRY_DELAY = 60000;

export const STATUS_LABELS: Record<string, string> = {
  pending: '待处理',
  processing: '处理中',
  shipped: '已发货',
  delivered: '已送达',
  completed: '已完成',
  cancelled: '已取消',
  failed: '处理失败'
};

export const STATUS_COLORS: Record<string, string> = {
  pending: 'gold',
  processing: 'blue',
  shipped: 'cyan',
  delivered: 'purple',
  completed: 'green',
  cancelled: 'default',
  failed: 'red'
};
