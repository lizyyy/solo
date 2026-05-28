import { UserPermission, SensitiveFieldConfig, AuditLogEntry } from '../types';
import { SENSITIVE_FIELDS } from '../data/mockData';

export class PermissionManager {
  private permission: UserPermission;
  private auditLog: AuditLogEntry[] = [];

  constructor(permission: UserPermission) {
    this.permission = permission;
  }

  updatePermission(permission: UserPermission): void {
    this.permission = permission;
  }

  getPermission(): UserPermission {
    return { ...this.permission };
  }

  canViewField(fieldName: string): boolean {
    const fieldConfig = SENSITIVE_FIELDS.find(f => f.field === fieldName);
    if (!fieldConfig) return true;
    if (!fieldConfig.requiresPermission) return true;
    return this.permission.canViewSensitive;
  }

  maskValue(fieldName: string, value: string | number | null): string | number | null {
    if (value === null || value === undefined) return value;
    if (this.canViewField(fieldName)) return value;
    
    const fieldConfig = SENSITIVE_FIELDS.find(f => f.field === fieldName);
    if (!fieldConfig || !fieldConfig.maskPattern) return value;
    
    return fieldConfig.maskPattern;
  }

  maskObject<T extends Record<string, unknown>>(obj: T): Partial<T> {
    const result: Partial<T> = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key];
        if (typeof value === 'string' || typeof value === 'number') {
          (result as Record<string, unknown>)[key] = this.maskValue(key, value);
        } else if (value !== null && typeof value === 'object') {
          (result as Record<string, unknown>)[key] = this.maskObject(value as Record<string, unknown>);
        } else {
          (result as Record<string, unknown>)[key] = value;
        }
      }
    }
    return result;
  }

  logAction(action: string, details?: Omit<AuditLogEntry, 'timestamp' | 'action' | 'userId'>): void {
    const entry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      action,
      userId: `user_${this.permission.role}`,
      ...details,
    };
    this.auditLog.push(entry);
  }

  getAuditLog(): AuditLogEntry[] {
    return [...this.auditLog];
  }

  getFieldConfig(fieldName: string): SensitiveFieldConfig | undefined {
    return SENSITIVE_FIELDS.find(f => f.field === fieldName);
  }

  getAllFieldConfigs(): SensitiveFieldConfig[] {
    return [...SENSITIVE_FIELDS];
  }

  filterSensitiveFields<T extends Record<string, unknown>>(
    data: T[],
    includeSensitive: boolean
  ): Partial<T>[] {
    if (includeSensitive && !this.permission.canViewSensitive) {
      throw new Error('权限不足：无法访问敏感字段');
    }
    if (includeSensitive) return data;
    return data.map(item => this.maskObject(item));
  }
}

export function createPermissionManager(permission: UserPermission): PermissionManager {
  return new PermissionManager(permission);
}

export const formatSensitiveLog = (
  fieldName: string,
  oldValue: unknown,
  newValue: unknown,
  canViewSensitive: boolean
): { oldValue: string; newValue: string } => {
  const fieldConfig = SENSITIVE_FIELDS.find(f => f.field === fieldName);
  const mask = fieldConfig?.maskPattern || '***';
  
  return {
    oldValue: canViewSensitive ? String(oldValue ?? '') : mask,
    newValue: canViewSensitive ? String(newValue ?? '') : mask,
  };
};
