const BLACKLIST_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  EXEMPTED: 'exempted',
  MANUALLY_CORRECTED: 'manually_corrected',
};

const BLACKLIST_SOURCE_TYPE = {
  MANUAL: 'manual',
  API_IMPORT: 'api_import',
  BATCH_UPLOAD: 'batch_upload',
  RISK_DETECTION: 'risk_detection',
  LEGACY_SYNC: 'legacy_sync',
};

const SHARE_VERSION_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
};

const EXEMPTION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
};

const EXEMPTION_TYPE = {
  TEMPORARY: 'temporary',
  PERMANENT: 'permanent',
  EMERGENCY: 'emergency',
};

const AUDIT_ACTION = {
  ADD: 'add',
  REMOVE: 'remove',
  UPDATE: 'update',
  SYNC: 'sync',
  HIT: 'hit',
  MANUAL_CORRECT: 'manual_correct',
  EXEMPTION_REQUEST: 'exemption_request',
  EXEMPTION_APPROVE: 'exemption_approve',
  EXEMPTION_REJECT: 'exemption_reject',
  EXEMPTION_EXPIRE: 'exemption_expire',
  EXEMPTION_REVOKE: 'exemption_revoke',
  VERSION_PUBLISH: 'version_publish',
  VERSION_ARCHIVE: 'version_archive',
  EXPORT: 'export',
  LOGIN: 'login',
};

const AUDIT_ENTITY_TYPE = {
  BLACKLIST: 'blacklist',
  EXEMPTION: 'exemption',
  SHARE_VERSION: 'share_version',
  USER: 'user',
  EXPORT: 'export',
};

const RISK_LEVEL = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

const ROLE = {
  ADMIN: 'admin',
  OPERATOR: 'operator',
  APPROVER: 'approver',
  VIEWER: 'viewer',
};

const PERMISSION = {
  BLACKLIST_READ: 'blacklist:read',
  BLACKLIST_WRITE: 'blacklist:write',
  BLACKLIST_MANAGE: 'blacklist:manage',
  EXEMPTION_REQUEST: 'exemption:request',
  EXEMPTION_APPROVE: 'exemption:approve',
  VERSION_PUBLISH: 'version:publish',
  AUDIT_VIEW: 'audit:view',
  REPORT_VIEW: 'report:view',
  EXPORT: 'export',
  USER_MANAGE: 'user:manage',
  SETTINGS_MANAGE: 'settings:manage',
};

const ROLE_PERMISSIONS = {
  [ROLE.ADMIN]: Object.values(PERMISSION),
  [ROLE.OPERATOR]: [
    PERMISSION.BLACKLIST_READ,
    PERMISSION.BLACKLIST_WRITE,
    PERMISSION.EXEMPTION_REQUEST,
    PERMISSION.AUDIT_VIEW,
    PERMISSION.REPORT_VIEW,
    PERMISSION.EXPORT,
  ],
  [ROLE.APPROVER]: [
    PERMISSION.BLACKLIST_READ,
    PERMISSION.EXEMPTION_APPROVE,
    PERMISSION.VERSION_PUBLISH,
    PERMISSION.AUDIT_VIEW,
    PERMISSION.REPORT_VIEW,
  ],
  [ROLE.VIEWER]: [
    PERMISSION.BLACKLIST_READ,
    PERMISSION.AUDIT_VIEW,
    PERMISSION.REPORT_VIEW,
  ],
};

module.exports = {
  BLACKLIST_STATUS,
  BLACKLIST_SOURCE_TYPE,
  SHARE_VERSION_STATUS,
  EXEMPTION_STATUS,
  EXEMPTION_TYPE,
  AUDIT_ACTION,
  AUDIT_ENTITY_TYPE,
  RISK_LEVEL,
  ROLE,
  PERMISSION,
  ROLE_PERMISSIONS,
};
