export const JWT_SECRET = process.env.JWT_SECRET || 'logistics-deduction-secret-key';
export const JWT_EXPIRES_IN = '24h';
export const PORT = parseInt(process.env.PORT || '3000', 10);
export const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

export const EXCEPTION_TYPES = {
  DELAY: 'delay',
  DAMAGE: 'damage',
  TRANSIT_RESPONSIBILITY: 'transit_responsibility',
} as const;

export const DETAIL_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  CONFIRMED: 'confirmed',
  REJECTED: 'rejected',
  APPEALED: 'appealed',
  ARCHIVED: 'archived',
} as const;

export const BATCH_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  ARCHIVED: 'archived',
} as const;

export const ROLES = {
  ADMIN: 'admin',
  OPERATOR: 'operator',
  AUDITOR: 'auditor',
} as const;
