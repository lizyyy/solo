import * as path from 'path';
import * as os from 'os';
import { SensitiveFieldConfig, EquipmentType } from './types';

export const DATA_DIR = path.join(os.homedir(), '.exhibition-rental');
export const DB_FILE = path.join(DATA_DIR, 'database.json');
export const LOG_FILE = path.join(DATA_DIR, 'audit.log');
export const EXPORT_DIR = path.join(DATA_DIR, 'exports');

export const DB_VERSION = '1.0.0';

export const PERMISSIONS = {
  EQUIPMENT_VIEW: 'equipment:view',
  EQUIPMENT_EDIT: 'equipment:edit',
  EQUIPMENT_IMPORT: 'equipment:import',
  BOOTH_VIEW: 'booth:view',
  BOOTH_EDIT: 'booth:edit',
  RENTAL_CREATE: 'rental:create',
  RENTAL_VIEW: 'rental:view',
  RENTAL_CONFIRM: 'rental:confirm',
  RENTAL_RETURN: 'rental:return',
  TRANSFER_CREATE: 'transfer:create',
  DAMAGE_REPORT: 'damage:report',
  AUDIT_VIEW: 'audit:view',
  EXPORT: 'export',
  ADMIN: 'admin'
};

export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  OPERATOR: 'operator',
  VIEWER: 'viewer'
};

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  [ROLES.ADMIN]: Object.values(PERMISSIONS),
  [ROLES.MANAGER]: [
    PERMISSIONS.EQUIPMENT_VIEW,
    PERMISSIONS.EQUIPMENT_EDIT,
    PERMISSIONS.EQUIPMENT_IMPORT,
    PERMISSIONS.BOOTH_VIEW,
    PERMISSIONS.BOOTH_EDIT,
    PERMISSIONS.RENTAL_CREATE,
    PERMISSIONS.RENTAL_VIEW,
    PERMISSIONS.RENTAL_CONFIRM,
    PERMISSIONS.RENTAL_RETURN,
    PERMISSIONS.TRANSFER_CREATE,
    PERMISSIONS.DAMAGE_REPORT,
    PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.EXPORT
  ],
  [ROLES.OPERATOR]: [
    PERMISSIONS.EQUIPMENT_VIEW,
    PERMISSIONS.BOOTH_VIEW,
    PERMISSIONS.RENTAL_CREATE,
    PERMISSIONS.RENTAL_VIEW,
    PERMISSIONS.RENTAL_RETURN,
    PERMISSIONS.TRANSFER_CREATE,
    PERMISSIONS.DAMAGE_REPORT
  ],
  [ROLES.VIEWER]: [
    PERMISSIONS.EQUIPMENT_VIEW,
    PERMISSIONS.BOOTH_VIEW,
    PERMISSIONS.RENTAL_VIEW
  ]
};

export const SENSITIVE_FIELDS: SensitiveFieldConfig[] = [
  {
    fields: ['contactPhone'],
    maskPattern: '****',
    roles: [ROLES.ADMIN, ROLES.MANAGER]
  },
  {
    fields: ['supplier'],
    maskPattern: '***',
    roles: [ROLES.ADMIN, ROLES.MANAGER]
  },
  {
    fields: ['pricePerDay'],
    maskPattern: '***',
    roles: [ROLES.ADMIN, ROLES.MANAGER]
  }
];

export const EQUIPMENT_CATEGORIES: Record<EquipmentType, string> = {
  [EquipmentType.TRUSS]: '桁架',
  [EquipmentType.LIGHT]: '灯具',
  [EquipmentType.SCREEN]: '屏幕'
};

export const DEFAULT_USER = {
  userId: 'default-user',
  userName: 'System',
  role: ROLES.ADMIN,
  permissions: ROLE_PERMISSIONS[ROLES.ADMIN]
};

export const IDEMPOTENCY_TTL_HOURS = 72;
export const BACKUP_RETENTION_DAYS = 30;
