import { UserContext, Booth, Equipment, RentalRecord, AuditLog } from './types';
import { SENSITIVE_FIELDS, ROLE_PERMISSIONS } from './config';
import { storage } from './storage';

export class SecurityManager {
  private currentUser: UserContext;

  constructor(user: UserContext) {
    this.currentUser = user;
  }

  public hasPermission(permission: string): boolean {
    return this.currentUser.permissions.includes(permission) || 
           this.currentUser.permissions.includes('admin');
  }

  public checkPermission(permission: string): void {
    if (!this.hasPermission(permission)) {
      throw new Error(`权限不足: 需要 ${permission} 权限`);
    }
  }

  private shouldMaskField(fieldName: string): boolean {
    for (const config of SENSITIVE_FIELDS) {
      if (config.fields.includes(fieldName)) {
        return !config.roles.includes(this.currentUser.role);
      }
    }
    return false;
  }

  private maskValue(value: any, fieldName: string): any {
    if (value === undefined || value === null) return value;
    
    for (const config of SENSITIVE_FIELDS) {
      if (config.fields.includes(fieldName)) {
        if (typeof value === 'string') {
          if (fieldName === 'contactPhone') {
            return value.substring(0, 3) + config.maskPattern + value.substring(value.length - 2);
          }
          return config.maskPattern;
        }
        if (typeof value === 'number') {
          return config.maskPattern;
        }
      }
    }
    return value;
  }

  public maskSensitiveData<T extends Record<string, any>>(obj: T): T {
    if (!obj || typeof obj !== 'object') return obj;

    const result = { ...obj };
    
    for (const key in result) {
      if (this.shouldMaskField(key)) {
        (result as any)[key] = this.maskValue(result[key], key);
      } else if (Array.isArray(result[key])) {
        (result as any)[key] = result[key].map((item: any) => 
          typeof item === 'object' ? this.maskSensitiveData(item) : item
        );
      } else if (typeof result[key] === 'object' && result[key] !== null) {
        (result as any)[key] = this.maskSensitiveData(result[key]);
      }
    }

    return result;
  }

  public maskBooth(booth: Booth): Booth {
    return this.maskSensitiveData(booth);
  }

  public maskEquipment(equipment: Equipment): Equipment {
    return this.maskSensitiveData(equipment);
  }

  public maskRentalRecord(record: RentalRecord): RentalRecord {
    return this.maskSensitiveData(record);
  }

  public maskAuditLog(log: AuditLog): AuditLog {
    const maskedLog = { ...log };
    for (const change of maskedLog.changes) {
      if (this.shouldMaskField(change.field)) {
        change.oldValue = this.maskValue(change.oldValue, change.field);
        change.newValue = this.maskValue(change.newValue, change.field);
      }
    }
    return maskedLog;
  }

  public logAuditLogList(logs: AuditLog[]): AuditLog[] {
    return logs.map(log => this.maskAuditLog(log));
  }

  public maskBoothList(booths: Booth[]): Booth[] {
    return booths.map(booth => this.maskBooth(booth));
  }

  public maskEquipmentList(equipment: Equipment[]): Equipment[] {
    return equipment.map(eq => this.maskEquipment(eq));
  }

  public maskRentalRecordList(records: RentalRecord[]): RentalRecord[] {
    return records.map(record => this.maskRentalRecord(record));
  }

  public getCurrentUser(): UserContext {
    return { ...this.currentUser };
  }

  public canViewSensitiveFields(): boolean {
    for (const config of SENSITIVE_FIELDS) {
      if (!config.roles.includes(this.currentUser.role)) {
          return true;
      }
    }
    return false;
  }
}

export function createSecurityManager(user: UserContext) {
  return new SecurityManager(user);
}
