const ORDER_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  REJECTED: 'rejected',
  SECOND_CONFIRMATION: 'second_confirmation',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  PENDING_REVIEW: 'pending_review',
  AUDIT_ONLY: 'audit_only',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

const STATUS_TRANSITIONS = {
  [ORDER_STATUS.DRAFT]: ['submitted', 'cancelled'],
  [ORDER_STATUS.SUBMITTED]: ['assigned', 'rejected', 'second_confirmation'],
  [ORDER_STATUS.REJECTED]: ['draft', 'cancelled'],
  [ORDER_STATUS.SECOND_CONFIRMATION]: ['assigned', 'rejected', 'cancelled'],
  [ORDER_STATUS.ASSIGNED]: ['in_progress', 'rejected'],
  [ORDER_STATUS.IN_PROGRESS]: ['pending_review'],
  [ORDER_STATUS.PENDING_REVIEW]: ['completed', 'rejected', 'in_progress'],
  [ORDER_STATUS.AUDIT_ONLY]: [],
  [ORDER_STATUS.COMPLETED]: ['audit_only'],
  [ORDER_STATUS.CANCELLED]: []
};

const TASK_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  FAILED: 'failed',
  COMPLETED: 'completed'
};

const FAIL_TYPES = {
  WAITING_RETRY: 'waiting_retry',
  WAITING_MANUAL: 'waiting_manual',
  PERMANENT: 'permanent'
};

const MERGE_STRATEGIES = {
  IGNORE: 'ignore',
  OVERWRITE: 'overwrite',
  APPEND: 'append'
};

const EVIDENCE_TYPES = {
  RESIDENT_SCREENSHOT: 'resident_screenshot',
  TECHNICIAN_RECEIPT: 'technician_receipt',
  MATERIAL_FORM: 'material_form',
  SMS_SCREENSHOT: 'sms_screenshot',
  STORE_TRANSFER: 'store_transfer',
  OTHER: 'other'
};

const ROLES = {
  ADMIN: 'admin',
  PROJECT_MANAGER: 'project_manager',
  DISPATCHER: 'dispatcher',
  TECHNICIAN: 'technician',
  AUDITOR: 'auditor',
  RESIDENT: 'resident'
};

const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: ['*'],
  [ROLES.PROJECT_MANAGER]: [
    'batch:view', 'batch:create', 'batch:export',
    'order:view', 'order:edit', 'order:review',
    'audit:view', 'report:view', 'report:export'
  ],
  [ROLES.DISPATCHER]: [
    'batch:view', 'batch:create',
    'order:view', 'order:create', 'order:submit', 'order:assign',
    'evidence:upload'
  ],
  [ROLES.TECHNICIAN]: [
    'order:view:assigned',
    'order:update:status',
    'evidence:upload'
  ],
  [ROLES.AUDITOR]: [
    'order:view',
    'audit:view',
    'batch:view',
    'batch:export:desensitized'
  ],
  [ROLES.RESIDENT]: [
    'order:view:own',
    'order:create'
  ]
};

const SENSITIVE_FIELDS = [
  'resident_phone',
  'resident_name',
  'assignee_id',
  'reviewer_id'
];

const REPAIR_TYPES = [
  '水电维修',
  '木工维修',
  '油漆维修',
  '泥工维修',
  '空调维修',
  '电梯维修',
  '公共区域维修',
  '其他'
];

const BATCH_STATUS = {
  PROCESSING: 'processing',
  PARTIAL_SUCCESS: 'partial_success',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

module.exports = {
  ORDER_STATUS,
  STATUS_TRANSITIONS,
  TASK_STATUS,
  FAIL_TYPES,
  MERGE_STRATEGIES,
  EVIDENCE_TYPES,
  ROLES,
  ROLE_PERMISSIONS,
  SENSITIVE_FIELDS,
  REPAIR_TYPES,
  BATCH_STATUS
};
