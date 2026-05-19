import { MaskConfig, MaskLevel } from '../models/types';

const DEFAULT_MASK_CONFIG: MaskConfig = {
  phone: 'partial',
  idCard: 'partial',
  plateNumber: 'partial'
};

export function maskPhone(phone: string, level: MaskLevel = 'partial'): string {
  if (!phone || level === 'none') return phone;

  if (level === 'full') {
    return '*'.repeat(phone.length);
  }

  if (phone.length === 11) {
    return phone.substring(0, 3) + '****' + phone.substring(7);
  }

  if (phone.length >= 7) {
    return phone.substring(0, 3) + '****' + phone.substring(phone.length - 2);
  }

  return phone.substring(0, 1) + '***';
}

export function maskIdCard(idCard: string, level: MaskLevel = 'partial'): string {
  if (!idCard || level === 'none') return idCard;

  if (level === 'full') {
    return '*'.repeat(idCard.length);
  }

  if (idCard.length === 18) {
    return idCard.substring(0, 6) + '********' + idCard.substring(14);
  }

  if (idCard.length >= 10) {
    return idCard.substring(0, 4) + '****' + idCard.substring(idCard.length - 2);
  }

  return idCard.substring(0, 1) + '***';
}

export function maskPlateNumber(plate: string, level: MaskLevel = 'partial'): string {
  if (!plate || level === 'none') return plate;

  if (level === 'full') {
    return '*'.repeat(plate.length);
  }

  if (plate.length >= 7) {
    return plate.substring(0, 2) + '***' + plate.substring(plate.length - 2);
  }

  return plate.substring(0, 1) + '***';
}

export function maskObject<T>(
  obj: T,
  config: Partial<MaskConfig> = {}
): T {
  const mergedConfig = { ...DEFAULT_MASK_CONFIG, ...config };
  const result = { ...obj } as any;

  for (const key of Object.keys(result)) {
    const value = result[key];

    if (typeof value === 'string') {
      const lowerKey = key.toLowerCase();

      if (lowerKey.includes('phone') || lowerKey.includes('mobile')) {
        result[key] = maskPhone(value, mergedConfig.phone);
      } else if (lowerKey.includes('idcard') || lowerKey.includes('idCard') || lowerKey.includes('identity')) {
        result[key] = maskIdCard(value, mergedConfig.idCard);
      } else if (lowerKey.includes('plate') || lowerKey.includes('car') || lowerKey.includes('vehicle')) {
        result[key] = maskPlateNumber(value, mergedConfig.plateNumber);
      }
    } else if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        result[key] = value.map(item =>
          typeof item === 'object' && item !== null ? maskObject(item, mergedConfig) : item
        );
      } else {
        result[key] = maskObject(value, mergedConfig);
      }
    }
  }

  return result;
}

export function createMasker(config: Partial<MaskConfig> = {}) {
  return {
    maskPhone: (phone: string) => maskPhone(phone, config.phone),
    maskIdCard: (idCard: string) => maskIdCard(idCard, config.idCard),
    maskPlateNumber: (plate: string) => maskPlateNumber(plate, config.plateNumber),
    maskObject: <T extends Record<string, unknown>>(obj: T) => maskObject(obj, config)
  };
}
