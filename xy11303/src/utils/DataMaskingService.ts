import { UserRole } from '../types';
import { PermissionService } from './PermissionService';

export interface MaskingOptions {
  maskPhone?: boolean;
  maskGuestInfo?: boolean;
  maskFinancial?: boolean;
  maskPassword?: boolean;
}

export class DataMaskingService {
  static maskPhone(phone: string | null | undefined): string {
    if (!phone) return '';
    if (phone.length <= 7) {
      return phone.substring(0, 3) + '****';
    }
    return phone.substring(0, 3) + '****' + phone.substring(phone.length - 4);
  }

  static maskName(name: string | null | undefined): string {
    if (!name) return '';
    if (name.length <= 1) return name + '*';
    return name.substring(0, 1) + '*'.repeat(name.length - 1);
  }

  static maskAddress(address: string | null | undefined): string {
    if (!address) return '';
    if (address.length <= 6) return '*'.repeat(address.length);
    return address.substring(0, 3) + '****' + address.substring(address.length - 3);
  }

  static maskId(id: string | null | undefined): string {
    if (!id) return '';
    if (id.length <= 8) return id;
    return id.substring(0, 4) + '****' + id.substring(id.length - 4);
  }

  static maskPassword(): string {
    return '********';
  }

  static maskAmount(amount: number | null | undefined, userRole: UserRole): number | null {
    if (amount === null || amount === undefined) return null;
    
    if (PermissionService.canAccessSensitiveFields(userRole)) {
      return amount;
    }
    
    return Math.round(amount / 10) * 10;
  }

  static sanitize<T>(
    data: T,
    userRole: UserRole,
    resourceType: string,
    options?: MaskingOptions
  ): Partial<T> {
    if (!data) return data as Partial<T>;

    const defaultOptions: MaskingOptions = {
      maskPhone: true,
      maskGuestInfo: true,
      maskFinancial: !PermissionService.canAccessSensitiveFields(userRole),
      maskPassword: true
    };

    const finalOptions = { ...defaultOptions, ...options };
    const sanitized = { ...data } as any;

    if (finalOptions.maskPassword && sanitized.passwordHash) {
      sanitized.passwordHash = this.maskPassword();
    }

    if (finalOptions.maskPhone) {
      if (sanitized.phone) sanitized.phone = this.maskPhone(sanitized.phone);
      if (sanitized.cleanerPhone) sanitized.cleanerPhone = this.maskPhone(sanitized.cleanerPhone);
      if (sanitized.guestPhone) sanitized.guestPhone = this.maskPhone(sanitized.guestPhone);
      if (sanitized.reporterPhone) sanitized.reporterPhone = this.maskPhone(sanitized.reporterPhone);
    }

    if (finalOptions.maskGuestInfo) {
      if (resourceType === 'orders' || resourceType === 'tasks') {
        if (sanitized.guestName && userRole === UserRole.CLEANER) {
          sanitized.guestName = this.maskName(sanitized.guestName);
        }
      }
    }

    if (finalOptions.maskFinancial) {
      if (sanitized.cleaningFee !== undefined) sanitized.cleaningFee = null;
      if (sanitized.amount !== undefined) sanitized.amount = null;
      if (sanitized.baseAmount !== undefined) sanitized.baseAmount = null;
      if (sanitized.reworkDeduction !== undefined) sanitized.reworkDeduction = null;
      if (sanitized.overtimeDeduction !== undefined) sanitized.overtimeDeduction = null;
      if (sanitized.complaintDeduction !== undefined) sanitized.complaintDeduction = null;
      if (sanitized.photoDeduction !== undefined) sanitized.photoDeduction = null;
      if (sanitized.otherDeduction !== undefined) sanitized.otherDeduction = null;
      if (sanitized.totalDeduction !== undefined) sanitized.totalDeduction = null;
      if (sanitized.netAmount !== undefined) sanitized.netAmount = null;
      if (sanitized.totalBaseAmount !== undefined) sanitized.totalBaseAmount = null;
      if (sanitized.totalReworkDeduction !== undefined) sanitized.totalReworkDeduction = null;
      if (sanitized.totalOvertimeDeduction !== undefined) sanitized.totalOvertimeDeduction = null;
      if (sanitized.totalComplaintDeduction !== undefined) sanitized.totalComplaintDeduction = null;
      if (sanitized.totalPhotoDeduction !== undefined) sanitized.totalPhotoDeduction = null;
      if (sanitized.totalOtherDeduction !== undefined) sanitized.totalOtherDeduction = null;
      if (sanitized.totalDeduction !== undefined) sanitized.totalDeduction = null;
      if (sanitized.deductionAmount !== undefined) sanitized.deductionAmount = null;
    }

    return sanitized as Partial<T>;
  }

  static sanitizeList<T>(
    data: T[],
    userRole: UserRole,
    resourceType: string,
    options?: MaskingOptions
  ): Partial<T>[] {
    return data.map(item => this.sanitize(item, userRole, resourceType, options));
  }

  static forLog(data: any): string {
    if (!data) return '';
    
    const sanitized = { ...data };
    
    if (sanitized.phone) sanitized.phone = this.maskPhone(sanitized.phone);
    if (sanitized.password) sanitized.password = this.maskPassword();
    if (sanitized.passwordHash) sanitized.passwordHash = this.maskPassword();
    if (sanitized.token) sanitized.token = '***masked***';
    
    return JSON.stringify(sanitized);
  }

  static forExport<T>(data: T, userRole: UserRole, resourceType: string): Partial<T> {
    return this.sanitize(data, userRole, resourceType, {
      maskPhone: true,
      maskGuestInfo: true,
      maskFinancial: !PermissionService.canAccessSensitiveFields(userRole),
      maskPassword: true
    });
  }
}
