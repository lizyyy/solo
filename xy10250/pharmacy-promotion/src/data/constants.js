export const PROMOTION_STATUS = {
  DRAFT: 'draft',
  REVIEW: 'review',
  ACTIVE: 'active',
  ENDED: 'ended'
}

export const PROMOTION_STATUS_LABEL = {
  [PROMOTION_STATUS.DRAFT]: '草稿',
  [PROMOTION_STATUS.REVIEW]: '审核中',
  [PROMOTION_STATUS.ACTIVE]: '生效中',
  [PROMOTION_STATUS.ENDED]: '已结束'
}

export const EXPIRY_LAYERS = {
  URGENCY: {
    name: '紧急层',
    maxDays: 30,
    color: '#f56c6c',
    icon: 'warning'
  },
  ATTENTION: {
    name: '关注层',
    minDays: 31,
    maxDays: 90,
    color: '#e6a23c',
    icon: 'info-filled'
  },
  EARLY_WARNING: {
    name: '预警层',
    minDays: 91,
    maxDays: 180,
    color: '#409eff',
    icon: 'info'
  },
  NORMAL: {
    name: '正常',
    minDays: 181,
    color: '#67c23a',
    icon: 'success'
  }
}

export const ISSUE_TYPES = {
  DATA_IMPORT: 'data_import',
  RULE_VALIDATION: 'rule_validation',
  PROMOTION_CREATE: 'promotion_create',
  PROMOTION_UPDATE: 'promotion_update'
}

export const ISSUE_TYPE_LABEL = {
  [ISSUE_TYPES.DATA_IMPORT]: '数据导入',
  [ISSUE_TYPES.RULE_VALIDATION]: '规则验证',
  [ISSUE_TYPES.PROMOTION_CREATE]: '促销创建',
  [ISSUE_TYPES.PROMOTION_UPDATE]: '促销更新'
}

export const DISCOUNT_TYPES = {
  PERCENTAGE: 'percentage',
  FIXED_AMOUNT: 'fixed_amount',
  BUNDLE: 'bundle'
}

export const DISCOUNT_TYPE_LABEL = {
  [DISCOUNT_TYPES.PERCENTAGE]: '折扣百分比',
  [DISCOUNT_TYPES.FIXED_AMOUNT]: '固定金额减免',
  [DISCOUNT_TYPES.BUNDLE]: '组合套餐价'
}
