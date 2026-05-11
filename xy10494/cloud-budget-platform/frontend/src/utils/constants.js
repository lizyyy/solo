export const ROLES = {
  ADMIN: 'admin',
  FINANCE: 'finance',
  DEVELOPER: 'developer',
  VIEWER: 'viewer',
};

export const ROLE_LABELS = {
  admin: '管理员',
  finance: '财务',
  developer: '开发人员',
  viewer: '查看者',
};

export const ALLOCATION_METHODS = {
  AUTO_TAG: 'auto_tag',
  MANUAL: 'manual',
  SHARED_SERVICE: 'shared_service',
  UNALLOCATED: 'unallocated',
};

export const ALLOCATION_METHOD_LABELS = {
  auto_tag: '标签自动匹配',
  manual: '人工分配',
  shared_service: '共享服务分摊',
  unallocated: '未分配',
};

export const ALLOCATION_METHOD_COLORS = {
  auto_tag: '#52c41a',
  manual: '#1890ff',
  shared_service: '#722ed1',
  unallocated: '#ff4d4f',
};

export const ANOMALY_TYPES = {
  NO_TAGS: 'no_tags',
  TAG_CONFLICT: 'tag_conflict',
  ALLOCATION_OVER_TOTAL: 'allocation_over_total',
  DUPLICATE_IMPORT: 'duplicate_import',
  ALLOCATION_RATIO_INVALID: 'allocation_ratio_invalid',
};

export const ANOMALY_TYPE_LABELS = {
  no_tags: '无标签资源',
  tag_conflict: '标签冲突',
  allocation_over_total: '分摊超额',
  duplicate_import: '重复导入',
  allocation_ratio_invalid: '分摊比例异常',
};

export const SEVERITY_LABELS = {
  low: '低',
  medium: '中',
  high: '高',
  critical: '严重',
};

export const SEVERITY_COLORS = {
  low: '#1890ff',
  medium: '#faad14',
  high: '#ff4d4f',
  critical: '#ff0000',
};

export const STATUS_LABELS = {
  open: '待处理',
  in_progress: '处理中',
  resolved: '已解决',
  ignored: '已忽略',
};

export const STATUS_COLORS = {
  open: '#ff4d4f',
  in_progress: '#faad14',
  resolved: '#52c41a',
  ignored: '#999',
};

export const BUDGET_PERIODS = {
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  YEARLY: 'yearly',
};

export const BUDGET_PERIOD_LABELS = {
  monthly: '月度',
  quarterly: '季度',
  yearly: '年度',
};

export const MATCH_TYPES = {
  EXACT: 'exact',
  CONTAINS: 'contains',
  STARTS_WITH: 'starts_with',
  REGEX: 'regex',
};

export const MATCH_TYPE_LABELS = {
  exact: '精确匹配',
  contains: '包含匹配',
  starts_with: '前缀匹配',
  regex: '正则表达式',
};

export const ENVIRONMENTS = {
  PRODUCTION: 'production',
  TEST: 'test',
  STAGING: 'staging',
  DEVELOPMENT: 'development',
  OTHER: 'other',
};

export const ENVIRONMENT_LABELS = {
  production: '生产环境',
  test: '测试环境',
  staging: '预发布环境',
  development: '开发环境',
  other: '其他',
};

export const ENVIRONMENT_COLORS = {
  production: '#ff4d4f',
  test: '#52c41a',
  staging: '#faad14',
  development: '#1890ff',
  other: '#999',
};

export const CLOUD_PROVIDERS = {
  ALIYUN: 'aliyun',
  AWS: 'aws',
  TENCENT: 'tencent',
  HUAWEI: 'huawei',
  OTHER: 'other',
};

export const CLOUD_PROVIDER_LABELS = {
  aliyun: '阿里云',
  aws: 'AWS',
  tencent: '腾讯云',
  huawei: '华为云',
  other: '其他',
};

export const BILL_IMPORT_STATUS = {
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  DUPLICATE: 'duplicate',
};

export const BILL_IMPORT_STATUS_LABELS = {
  processing: '处理中',
  completed: '已完成',
  failed: '失败',
  duplicate: '重复导入',
};

export const BILL_IMPORT_STATUS_COLORS = {
  processing: '#1890ff',
  completed: '#52c41a',
  failed: '#ff4d4f',
  duplicate: '#faad14',
};
