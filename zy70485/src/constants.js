export const RECON_STATUS = {
  PENDING: 'pending',
  MATCHED: 'matched',
  PARTIAL_SUCCESS: 'partial_success',
  SUCCESS: 'success',
  FAILED: 'failed',
  MANUAL_CORRECTED: 'manual_corrected',
  RECEIPT_LATE: 'receipt_late'
}

export const ITEM_STATUS = {
  PENDING: 'pending',
  MATCHED: 'matched',
  SUCCESS: 'success',
  FAILED: 'failed',
  WAITING_RECEIPT: 'waiting_receipt',
  OVERDUE: 'overdue',
  MANUAL_CORRECTED: 'manual_corrected'
}

export const DEPARTMENTS = {
  RISK: '风控合规部',
  OPS: '运维保障部',
  PRODUCT: '产品研发部',
  FINANCE: '财务结算部',
  SECURITY: '安全应急部'
}

export const CONFIG_TYPES = {
  VERSION_FREEZE: '版本冻结通知',
  GRAYSCALE_SWITCH: '灰度开关配置',
  WHITELIST: '白名单配置',
  RATE_LIMIT: '限流策略',
  DATA_RETENTION: '数据留存策略'
}

export const STATUS_LABELS = {
  [RECON_STATUS.PENDING]: '待处理',
  [RECON_STATUS.MATCHED]: '已匹配',
  [RECON_STATUS.PARTIAL_SUCCESS]: '部分成功',
  [RECON_STATUS.SUCCESS]: '全部成功',
  [RECON_STATUS.FAILED]: '对账失败',
  [RECON_STATUS.MANUAL_CORRECTED]: '人工修正',
  [RECON_STATUS.RECEIPT_LATE]: '回执晚到'
}

export const ITEM_STATUS_LABELS = {
  [ITEM_STATUS.PENDING]: '待核对',
  [ITEM_STATUS.MATCHED]: '已匹配',
  [ITEM_STATUS.SUCCESS]: '执行成功',
  [ITEM_STATUS.FAILED]: '执行失败',
  [ITEM_STATUS.WAITING_RECEIPT]: '等待回执',
  [ITEM_STATUS.OVERDUE]: '回执逾期',
  [ITEM_STATUS.MANUAL_CORRECTED]: '人工修正'
}
