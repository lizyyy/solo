export const SAMPLE_STATUS = {
  PENDING_REVIEW: 'pending_review',
  NORMAL: 'normal',
  ABNORMAL: 'abnormal',
  MODEL_VERSION_CHANGED: 'model_version_changed',
  REVIEW_CONFIRMED: 'review_confirmed',
  REVIEW_REJECTED: 'review_rejected',
  ROLLED_BACK: 'rolled_back'
}

export const SAMPLE_STATUS_LABEL = {
  [SAMPLE_STATUS.PENDING_REVIEW]: '待复核',
  [SAMPLE_STATUS.NORMAL]: '正常',
  [SAMPLE_STATUS.ABNORMAL]: '异常',
  [SAMPLE_STATUS.MODEL_VERSION_CHANGED]: '模型版本变更待复核',
  [SAMPLE_STATUS.REVIEW_CONFIRMED]: '复核通过',
  [SAMPLE_STATUS.REVIEW_REJECTED]: '复核驳回',
  [SAMPLE_STATUS.ROLLED_BACK]: '已回滚'
}

export const SAMPLE_STATUS_COLOR = {
  [SAMPLE_STATUS.PENDING_REVIEW]: 'orange',
  [SAMPLE_STATUS.NORMAL]: 'green',
  [SAMPLE_STATUS.ABNORMAL]: 'red',
  [SAMPLE_STATUS.MODEL_VERSION_CHANGED]: 'gold',
  [SAMPLE_STATUS.REVIEW_CONFIRMED]: 'green',
  [SAMPLE_STATUS.REVIEW_REJECTED]: 'red',
  [SAMPLE_STATUS.ROLLED_BACK]: 'default'
}

export const OPERATION_TYPE_LABEL = {
  batch_import: '批次导入',
  update_status: '状态更新',
  add_comment: '添加留言',
  review_confirm: '复核通过',
  review_reject: '复核驳回',
  rollback: '回滚操作',
  edit_manual: '人工修改'
}

export const ROLE_LABEL = {
  annotator: '标注员',
  annotation_lead: '标注负责人',
  operation_reviewer: '运营复核人',
  product: '产品'
}
