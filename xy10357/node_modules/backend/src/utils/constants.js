const SHIPMENT_STATUS_LABELS = {
  PENDING: '待处理',
  APPROVED: '已通过',
  REJECTED: '已驳回',
  SHIPPED: '已寄送',
  DELIVERED: '已签收',
  DESTROYED: '已销毁',
  CLOSED: '已关闭'
};

const TEMP_STATUS_LABELS = {
  NORMAL: '正常',
  WARNING: '警告',
  EXCEEDED: '超限',
  REVIEWED: '已复核'
};

const AUDIT_ACTION_LABELS = {
  CREATE: '创建',
  UPDATE: '更新',
  APPROVE: '审批通过',
  REJECT: '审批驳回',
  SHIP: '发出',
  DELIVER: '签收',
  DESTROY: '销毁',
  CLOSE: '关闭',
  REVIEW: '复核',
  UPLOAD: '上传'
};

const STATUS_GROUPS = {
  PENDING: ['PENDING'],
  APPROVED: ['APPROVED', 'SHIPPED', 'DELIVERED', 'DESTROYED'],
  REJECTED: ['REJECTED', 'CLOSED']
};

module.exports = {
  SHIPMENT_STATUS_LABELS,
  TEMP_STATUS_LABELS,
  AUDIT_ACTION_LABELS,
  STATUS_GROUPS
};
