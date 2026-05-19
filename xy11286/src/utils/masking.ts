import { getDb } from '../db/database';
import { SensitiveFieldConfig } from '../types';

export function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) return phone;
  const prefix = phone.slice(0, 3);
  const suffix = phone.slice(-4);
  return `${prefix}****${suffix}`;
}

export function maskName(name: string): string {
  if (!name || name.length <= 1) return name;
  const first = name[0];
  const stars = '*'.repeat(name.length - 1);
  return `${first}${stars}`;
}

export function maskIdCard(idCard: string): string {
  if (!idCard || idCard.length < 8) return idCard;
  const prefix = idCard.slice(0, 4);
  const suffix = idCard.slice(-4);
  return `${prefix}********${suffix}`;
}

export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email;
  const [username, domain] = email.split('@');
  if (username.length <= 2) return `*@${domain}`;
  const prefix = username.slice(0, 2);
  return `${prefix}***@${domain}`;
}

export function maskCustom(value: string, pattern?: string): string {
  if (!value) return value;
  if (!pattern) return maskPhone(value);
  return pattern.replace('{value}', value);
}

export function getMaskFunction(maskType: string): (value: string, pattern?: string) => string {
  const maskMap: Record<string, (value: string, pattern?: string) => string> = {
    phone: maskPhone,
    name: maskName,
    idcard: maskIdCard,
    email: maskEmail,
    custom: maskCustom,
  };
  return maskMap[maskType] || maskPhone;
}

export function getSensitiveConfigs(): SensitiveFieldConfig[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM sensitive_field_configs').all() as any[];
  return rows.map(row => ({
    entity: row.entity,
    field: row.field,
    maskType: row.mask_type,
    maskPattern: row.mask_pattern,
    exportMasked: row.export_masked,
    logMasked: row.log_masked,
  }));
}

export function maskEntityData<T extends Record<string, any>>(
  entity: T,
  entityType: string,
  context: 'export' | 'log' | 'display'
): T {
  const configs = getSensitiveConfigs().filter(c => c.entity === entityType);
  const result = { ...entity };

  for (const config of configs) {
    const shouldMask = context === 'export' ? config.exportMasked : config.logMasked;
    if (shouldMask && result[config.field]) {
      const maskFn = getMaskFunction(config.maskType);
      result[config.field] = maskFn(String(result[config.field]), config.maskPattern);
    }
  }

  return result;
}

export function maskLogData(data: any, entityType?: string): any {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  if (entityType) {
    return maskEntityData(data, entityType, 'log');
  }

  if (Array.isArray(data)) {
    return data.map(item => maskLogData(item));
  }

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      if (key.toLowerCase().includes('phone') || key.toLowerCase().includes('tel')) {
        result[key] = maskPhone(value);
      } else if (key.toLowerCase().includes('name') && !key.toLowerCase().includes('medicine')) {
        result[key] = maskName(value);
      } else if (key.toLowerCase().includes('id') && key.toLowerCase().includes('card')) {
        result[key] = maskIdCard(value);
      } else if (key.toLowerCase().includes('email')) {
        result[key] = maskEmail(value);
      } else {
        result[key] = value;
      }
    } else if (typeof value === 'object') {
      result[key] = maskLogData(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function maskExportData<T extends Record<string, any>>(data: T, entityType: string): T {
  return maskEntityData(data, entityType, 'export');
}