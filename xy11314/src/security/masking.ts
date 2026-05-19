import { ParentComplaint, Adjudication } from '../types';

export type UserRole = 'admin' | 'dispatcher' | 'auditor' | 'viewer';

export interface MaskingConfig {
  enabled: boolean;
  maskPhone: boolean;
  maskName: boolean;
  maskLocation: boolean;
  allowedRolesForFullAccess: UserRole[];
}

const DEFAULT_CONFIG: MaskingConfig = {
  enabled: true,
  maskPhone: true,
  maskName: true,
  maskLocation: false,
  allowedRolesForFullAccess: ['admin', 'auditor']
};

export function maskPhoneNumber(phone: string): string {
  if (!phone || phone.length < 7) return '***';
  return phone.substring(0, 3) + '****' + phone.substring(phone.length - 4);
}

export function maskName(name: string): string {
  if (!name || name.length === 0) return '***';
  if (name.length === 1) return name + '*';
  if (name.length === 2) return name.substring(0, 1) + '*';
  return name.substring(0, 1) + '*'.repeat(name.length - 2) + name.substring(name.length - 1);
}

export function maskCoordinates(lat: number, lng: number): { latitude: number; longitude: number } {
  return {
    latitude: Math.round(lat * 100) / 100,
    longitude: Math.round(lng * 100) / 100
  };
}

export function shouldMaskSensitiveData(
  userRole: UserRole,
  config: MaskingConfig = DEFAULT_CONFIG
): boolean {
  if (!config.enabled) return false;
  return !config.allowedRolesForFullAccess.includes(userRole);
}

export function maskComplaint(
  complaint: ParentComplaint,
  userRole: UserRole,
  config: MaskingConfig = DEFAULT_CONFIG
): ParentComplaint {
  if (!shouldMaskSensitiveData(userRole, config)) {
    return complaint;
  }

  const masked = { ...complaint };

  if (config.maskPhone) {
    masked.parentPhone = maskPhoneNumber(complaint.parentPhone);
  }

  if (config.maskName) {
    masked.parentName = maskName(complaint.parentName);
    masked.studentName = maskName(complaint.studentName);
  }

  return masked;
}

export function maskAdjudication(
  adjudication: Adjudication,
  userRole: UserRole,
  config: MaskingConfig = DEFAULT_CONFIG
): Adjudication {
  if (!shouldMaskSensitiveData(userRole, config)) {
    return adjudication;
  }

  return {
    ...adjudication,
    evidence: {
      ...adjudication.evidence
    }
  };
}

export function maskAuditLogDetails(details: string, userRole: UserRole): string {
  try {
    const parsed = JSON.parse(details);
    if (parsed.parentPhone) {
      parsed.parentPhone = maskPhoneNumber(parsed.parentPhone);
    }
    if (parsed.parentName) {
      parsed.parentName = maskName(parsed.parentName);
    }
    if (parsed.studentName) {
      parsed.studentName = maskName(parsed.studentName);
    }
    return JSON.stringify(parsed);
  } catch {
    return details;
  }
}

export function maskBadRecord(badRecord: any, userRole: UserRole): any {
  if (!shouldMaskSensitiveData(userRole, DEFAULT_CONFIG)) {
    return badRecord;
  }

  try {
    const rawData = JSON.parse(badRecord.rawData);
    if (rawData.parentPhone) {
      rawData.parentPhone = maskPhoneNumber(rawData.parentPhone);
    }
    if (rawData.parentName) {
      rawData.parentName = maskName(rawData.parentName);
    }
    if (rawData.studentName) {
      rawData.studentName = maskName(rawData.studentName);
    }
    return {
      ...badRecord,
      rawData: JSON.stringify(rawData)
    };
  } catch {
    return badRecord;
  }
}

export { DEFAULT_CONFIG };
