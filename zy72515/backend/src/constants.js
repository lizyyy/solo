const SAMPLE_STATUS = {
  PENDING_REVIEW: 'pending_review',
  NORMAL: 'normal',
  ABNORMAL: 'abnormal',
  MODEL_VERSION_CHANGED: 'model_version_changed',
  REVIEW_CONFIRMED: 'review_confirmed',
  REVIEW_REJECTED: 'review_rejected',
  ROLLED_BACK: 'rolled_back'
}

const SAMPLE_STATUS_LABEL = {
  [SAMPLE_STATUS.PENDING_REVIEW]: '待复核',
  [SAMPLE_STATUS.NORMAL]: '正常',
  [SAMPLE_STATUS.ABNORMAL]: '异常',
  [SAMPLE_STATUS.MODEL_VERSION_CHANGED]: '模型版本变更待复核',
  [SAMPLE_STATUS.REVIEW_CONFIRMED]: '复核通过',
  [SAMPLE_STATUS.REVIEW_REJECTED]: '复核驳回',
  [SAMPLE_STATUS.ROLLED_BACK]: '已回滚'
}

const SAMPLE_STATUS_COLOR = {
  [SAMPLE_STATUS.PENDING_REVIEW]: 'orange',
  [SAMPLE_STATUS.NORMAL]: 'green',
  [SAMPLE_STATUS.ABNORMAL]: 'red',
  [SAMPLE_STATUS.MODEL_VERSION_CHANGED]: 'gold',
  [SAMPLE_STATUS.REVIEW_CONFIRMED]: 'green',
  [SAMPLE_STATUS.REVIEW_REJECTED]: 'red',
  [SAMPLE_STATUS.ROLLED_BACK]: 'default'
}

const OPERATION_TYPE = {
  BATCH_IMPORT: 'batch_import',
  UPDATE_STATUS: 'update_status',
  ADD_COMMENT: 'add_comment',
  REVIEW_CONFIRM: 'review_confirm',
  REVIEW_REJECT: 'review_reject',
  ROLLBACK: 'rollback',
  EDIT_MANUAL: 'edit_manual'
}

const OPERATION_TYPE_LABEL = {
  [OPERATION_TYPE.BATCH_IMPORT]: '批次导入',
  [OPERATION_TYPE.UPDATE_STATUS]: '状态更新',
  [OPERATION_TYPE.ADD_COMMENT]: '添加留言',
  [OPERATION_TYPE.REVIEW_CONFIRM]: '复核通过',
  [OPERATION_TYPE.REVIEW_REJECT]: '复核驳回',
  [OPERATION_TYPE.ROLLBACK]: '回滚操作',
  [OPERATION_TYPE.EDIT_MANUAL]: '人工修改'
}

const BOUNDARY_RULES = {
  MODEL_VERSION_CHANGED_SAME_ID: {
    code: 'MODEL_VERSION_CHANGED_SAME_ID',
    name: '模型版本换了但样本编号没变',
    description: '同一批次或跨批次中，样本编号相同但模型版本号不一致',
    autoStatus: SAMPLE_STATUS.MODEL_VERSION_CHANGED,
    requireReview: true,
    allowAutoNormal: false,
    explanation: '该样本编号在之前批次中使用过，但本次使用的模型版本不同。需要运营复核人确认是否为正常迭代。'
  },
  DUPLICATE_SAMPLE_IN_BATCH: {
    code: 'DUPLICATE_SAMPLE_IN_BATCH',
    name: '同一批次内重复样本编号',
    description: '同一灰度批次内出现相同的样本编号',
    autoStatus: SAMPLE_STATUS.ABNORMAL,
    requireReview: true,
    allowAutoNormal: false,
    explanation: '同一批次内样本编号重复，请检查导入数据是否正确。'
  },
  NORMAL_SAMPLE: {
    code: 'NORMAL_SAMPLE',
    name: '正常样本',
    description: '无异常的样本记录',
    autoStatus: SAMPLE_STATUS.NORMAL,
    requireReview: false,
    allowAutoNormal: true,
    explanation: '样本数据正常，无异常标记。'
  }
}

const ROLES = {
  ANNOTATOR: 'annotator',
  ANNOTATION_LEAD: 'annotation_lead',
  OPERATION_REVIEWER: 'operation_reviewer',
  PRODUCT: 'product'
}

const ROLE_LABEL = {
  [ROLES.ANNOTATOR]: '标注员',
  [ROLES.ANNOTATION_LEAD]: '标注负责人',
  [ROLES.OPERATION_REVIEWER]: '运营复核人',
  [ROLES.PRODUCT]: '产品'
}

module.exports = {
  SAMPLE_STATUS,
  SAMPLE_STATUS_LABEL,
  SAMPLE_STATUS_COLOR,
  OPERATION_TYPE,
  OPERATION_TYPE_LABEL,
  BOUNDARY_RULES,
  ROLES,
  ROLE_LABEL
}
