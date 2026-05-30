export const BillStatus = {
  DRAFT: 'draft',
  NORMAL: 'normal',
  ENDORSED: 'endorsed',
  COLLECTING: 'collecting',
  COLLECTED: 'collected',
  DISCOUNTED: 'discounted',
  EXPIRED: 'expired',
  VOID: 'void'
}

export const BillStatusText = {
  draft: '暂存',
  normal: '正常持有',
  endorsed: '已背书',
  collecting: '托收中',
  collected: '托收完成',
  discounted: '已贴现',
  expired: '已逾期',
  void: '已作废'
}

export const ProcessStatus = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  RETURNED: 'returned',
  TEMP: 'temp'
}

export const ProcessStatusText = {
  pending: '待处理',
  confirmed: '已确认',
  returned: '已退回',
  temp: '暂存'
}

export const ReminderType = {
  MATURE_7D: 'mature_7d',
  MATURE_3D: 'mature_3d',
  MATURE_1D: 'mature_1d',
  MATURE_TODAY: 'mature_today',
  OVERDUE: 'overdue'
}

export const ReminderTypeText = {
  mature_7d: '到期前7天',
  mature_3d: '到期前3天',
  mature_1d: '到期前1天',
  mature_today: '今日到期',
  overdue: '已逾期'
}

export const EndorseType = {
  TRANSFER: 'transfer',
  PLEDGE: 'pledge',
  COLLECTION: 'collection'
}

export const EndorseTypeText = {
  transfer: '转让背书',
  pledge: '质押背书',
  collection: '托收背书'
}

export const CollectionStatus = {
  APPLIED: 'applied',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  PAID: 'paid'
}

export const CollectionStatusText = {
  applied: '已申请',
  accepted: '已受理',
  rejected: '已驳回',
  paid: '已兑付'
}

export const DiscountStatus = {
  APPLIED: 'applied',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  PAID: 'paid'
}

export const DiscountStatusText = {
  applied: '已申请',
  approved: '已审批',
  rejected: '已驳回',
  paid: '已放款'
}

export const BillSchema = {
  name: 'bills',
  keyPath: 'id',
  indexes: [
    { name: 'billNo', unique: true },
    { name: 'acceptDate', unique: false },
    { name: 'matureDate', unique: false },
    { name: 'status', unique: false },
    { name: 'processStatus', unique: false },
    { name: 'createdAt', unique: false }
  ]
}

export const EndorseSchema = {
  name: 'endorses',
  keyPath: 'id',
  indexes: [
    { name: 'billId', unique: false },
    { name: 'billNo', unique: false },
    { name: 'endorseDate', unique: false },
    { name: 'sequence', unique: false },
    { name: 'createdAt', unique: false }
  ]
}

export const CollectionSchema = {
  name: 'collections',
  keyPath: 'id',
  indexes: [
    { name: 'billId', unique: false },
    { name: 'billNo', unique: false },
    { name: 'applyDate', unique: false },
    { name: 'status', unique: false },
    { name: 'idemKey', unique: true },
    { name: 'createdAt', unique: false }
  ]
}

export const DiscountSchema = {
  name: 'discounts',
  keyPath: 'id',
  indexes: [
    { name: 'billId', unique: false },
    { name: 'billNo', unique: false },
    { name: 'applyDate', unique: false },
    { name: 'status', unique: false },
    { name: 'idemKey', unique: true },
    { name: 'createdAt', unique: false }
  ]
}

export const ReminderSchema = {
  name: 'reminders',
  keyPath: 'id',
  indexes: [
    { name: 'billId', unique: false },
    { name: 'billNo', unique: false },
    { name: 'reminderDate', unique: false },
    { name: 'reminderType', unique: false },
    { name: 'idemKey', unique: true },
    { name: 'processStatus', unique: false },
    { name: 'createdAt', unique: false }
  ]
}

export const ReportSchema = {
  name: 'reports',
  keyPath: 'id',
  indexes: [
    { name: 'reportDate', unique: false },
    { name: 'reportType', unique: false },
    { name: 'idemKey', unique: true },
    { name: 'createdAt', unique: false }
  ]
}

export const RemarkSchema = {
  name: 'remarks',
  keyPath: 'id',
  indexes: [
    { name: 'targetType', unique: false },
    { name: 'targetId', unique: false },
    { name: 'createdAt', unique: false }
  ]
}

export const OperationLogSchema = {
  name: 'operationLogs',
  keyPath: 'id',
  indexes: [
    { name: 'targetType', unique: false },
    { name: 'targetId', unique: false },
    { name: 'operation', unique: false },
    { name: 'createdAt', unique: false }
  ]
}
