export const BATCH_STATUS = {
  uploaded: 'uploaded',
  mapping_configured: 'mapping_configured',
  precheck_passed: 'precheck_passed',
  precheck_failed: 'precheck_failed',
  trial_imported: 'trial_imported',
  confirmed: 'confirmed',
  rolled_back: 'rolled_back',
};

export const BATCH_STATUS_TEXT = {
  uploaded: '已上传',
  mapping_configured: '映射已配置',
  precheck_passed: '预检通过',
  precheck_failed: '预检失败',
  trial_imported: '已试导入',
  confirmed: '已确认',
  rolled_back: '已回滚',
};

export const BATCH_TYPE_TEXT = {
  customer: '客户导入',
  product: '商品导入',
};

export const ERROR_TYPE_TEXT = {
  required_missing: '必填缺失',
  enum_invalid: '枚举不合法',
  duplicate: '重复数据',
  mapping_conflict: '映射冲突',
  format_invalid: '格式错误',
  business_rule: '业务规则',
  system_error: '系统错误',
};

export const ACTION_TEXT = {
  upload: '上传数据',
  configure_mapping: '配置映射',
  precheck: '执行预检',
  trial_import: '试导入',
  confirm: '确认导入',
  rollback: '回滚批次',
};

export const STEPS = [
  {
    key: 'upload',
    title: '上传数据',
    description: '上传或粘贴 CSV/JSON 数据',
    validStatuses: ['uploaded', 'mapping_configured', 'precheck_passed', 'precheck_failed', 'trial_imported', 'confirmed', 'rolled_back'],
  },
  {
    key: 'mapping',
    title: '字段映射',
    description: '配置源列与目标字段的映射关系',
    validStatuses: ['mapping_configured', 'precheck_passed', 'precheck_failed', 'trial_imported', 'confirmed', 'rolled_back'],
  },
  {
    key: 'precheck',
    title: '数据预检',
    description: '校验必填、枚举、格式、重复等规则',
    validStatuses: ['precheck_passed', 'precheck_failed', 'trial_imported', 'confirmed', 'rolled_back'],
  },
  {
    key: 'trial',
    title: '试导入',
    description: '预览将导入的数据，确认无误后正式导入',
    validStatuses: ['trial_imported', 'confirmed', 'rolled_back'],
  },
  {
    key: 'confirm',
    title: '确认导入',
    description: '正式落库，可回滚',
    validStatuses: ['confirmed', 'rolled_back'],
  },
];
