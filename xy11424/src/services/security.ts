import { UserRole, PreparationLedger, InspectionOrder, RepairQuote, PhotoInventory, AuditLog } from '../types';

export class SecurityService {
  private static sensitiveFields: Record<string, Set<string>> = {
    inspection: new Set(['inspectorName', 'remarks']),
    repair: new Set(['quoteManager', 'repairShop', 'remarks']),
    photo: new Set(['uploader', 'remarks']),
    ledger: new Set(['responsiblePerson'])
  };

  private static rolePermissions: Record<UserRole, { canViewSensitive: boolean; canEdit: boolean; canExport: boolean; canAudit: boolean }> = {
    [UserRole.ADMIN]: { canViewSensitive: true, canEdit: true, canExport: true, canAudit: true },
    [UserRole.AUDITOR]: { canViewSensitive: true, canEdit: false, canExport: true, canAudit: true },
    [UserRole.FINANCIAL]: { canViewSensitive: false, canEdit: false, canExport: true, canAudit: false },
    [UserRole.REPAIR_MANAGER]: { canViewSensitive: true, canEdit: true, canExport: false, canAudit: false },
    [UserRole.INSPECTOR]: { canViewSensitive: true, canEdit: true, canExport: false, canAudit: false }
  };

  static getRolePermissions(role: UserRole) {
    return this.rolePermissions[role] || { canViewSensitive: false, canEdit: false, canExport: false, canAudit: false };
  }

  private static maskValue(value: any, field: string): any {
    if (value === null || value === undefined) return value;
    
    if (typeof value === 'string') {
      if (value.length <= 2) return '*'.repeat(value.length);
      return value[0] + '*'.repeat(value.length - 2) + value[value.length - 1];
    }
    
    if (typeof value === 'number') {
      return '***';
    }
    
    return '***';
  }

  static maskInspectionOrder(order: InspectionOrder, role: UserRole): InspectionOrder {
    const permissions = this.getRolePermissions(role);
    if (permissions.canViewSensitive) return order;

    const masked = { ...order };
    for (const field of this.sensitiveFields.inspection) {
      if (field in masked) {
        (masked as any)[field] = this.maskValue((masked as any)[field], field);
      }
    }
    return masked;
  }

  static maskRepairQuote(quote: RepairQuote, role: UserRole): RepairQuote {
    const permissions = this.getRolePermissions(role);
    if (permissions.canViewSensitive) return quote;

    const masked = { ...quote };
    for (const field of this.sensitiveFields.repair) {
      if (field in masked) {
        (masked as any)[field] = this.maskValue((masked as any)[field], field);
      }
    }
    return masked;
  }

  static maskPhotoInventory(inventory: PhotoInventory, role: UserRole): PhotoInventory {
    const permissions = this.getRolePermissions(role);
    if (permissions.canViewSensitive) return inventory;

    const masked = { ...inventory };
    for (const field of this.sensitiveFields.photo) {
      if (field in masked) {
        (masked as any)[field] = this.maskValue((masked as any)[field], field);
      }
    }
    return masked;
  }

  static maskLedger(ledger: PreparationLedger, role: UserRole): PreparationLedger {
    const permissions = this.getRolePermissions(role);
    if (permissions.canViewSensitive) return ledger;

    const masked: PreparationLedger = { ...ledger };
    
    if (masked.inspectionOrder) {
      masked.inspectionOrder = this.maskInspectionOrder(masked.inspectionOrder, role);
    }
    if (masked.repairQuote) {
      masked.repairQuote = this.maskRepairQuote(masked.repairQuote, role);
    }
    if (masked.photoInventory) {
      masked.photoInventory = this.maskPhotoInventory(masked.photoInventory, role);
    }
    
    for (const field of this.sensitiveFields.ledger) {
      if (field in masked) {
        (masked as any)[field] = this.maskValue((masked as any)[field], field);
      }
    }
    
    return masked;
  }

  static maskAuditLog(log: AuditLog, role: UserRole): AuditLog {
    const permissions = this.getRolePermissions(role);
    if (permissions.canViewSensitive) return log;

    const masked = { ...log };
    if (masked.fieldChanges) {
      masked.fieldChanges = masked.fieldChanges.map(change => ({
        ...change,
        oldValue: change.isSensitive ? this.maskValue(change.oldValue, change.field) : change.oldValue,
        newValue: change.isSensitive ? this.maskValue(change.newValue, change.field) : change.newValue
      }));
    }
    return masked;
  }

  static canEdit(role: UserRole): boolean {
    return this.getRolePermissions(role).canEdit;
  }

  static canExport(role: UserRole): boolean {
    return this.getRolePermissions(role).canExport;
  }

  static canAudit(role: UserRole): boolean {
    return this.getRolePermissions(role).canAudit;
  }

  static canViewSensitive(role: UserRole): boolean {
    return this.getRolePermissions(role).canViewSensitive;
  }
}

export default SecurityService;
