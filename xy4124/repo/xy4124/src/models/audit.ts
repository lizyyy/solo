import { BaseEntity } from './common';

export enum AuditAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  IMPORT = 'import',
  EXPORT = 'export',
  CHECK = 'check',
  READ = 'read',
}

export enum AuditEntityType {
  FILM_VERSION = 'film_version',
  AUDITORIUM_DEVICE = 'auditorium_device',
  KDM = 'kdm',
  SCHEDULE = 'schedule',
  PROJECTION_CHECK = 'projection_check',
}

export interface AuditLog extends BaseEntity {
  auditId: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  actor: string;
  actorRole: string;
  changes?: Record<string, unknown>;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
}

export interface AuditLogCreateInput {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  actor: string;
  actorRole: string;
  changes?: Record<string, unknown>;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
}
