import { SensitiveConfig } from '../types';

const defaultConfig: SensitiveConfig = {
  fields: ['operatorIdCard', 'operatorPhone', 'operator_id_card', 'operator_phone'],
  maskLength: 4,
  maskChar: '*'
};

export function maskSensitiveData<T extends Record<string, any>>(
  data: T,
  config: SensitiveConfig = defaultConfig
): T {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const result = { ...data };

  for (const key of Object.keys(result)) {
    if (config.fields.includes(key)) {
      result[key] = maskString(String(result[key]), config);
    } else if (Array.isArray(result[key])) {
      result[key] = result[key].map(item => 
        typeof item === 'object' ? maskSensitiveData(item, config) : item
      );
    } else if (result[key] !== null && typeof result[key] === 'object') {
      result[key] = maskSensitiveData(result[key], config);
    }
  }

  return result;
}

function maskString(value: string, config: SensitiveConfig): string {
  if (!value || value.length <= config.maskLength * 2) {
    return config.maskChar.repeat(config.maskLength);
  }

  const prefix = value.slice(0, config.maskLength);
  const suffix = value.slice(-config.maskLength);
  const middleLength = value.length - config.maskLength * 2;

  return prefix + config.maskChar.repeat(middleLength) + suffix;
}

export function maskLogData(data: any): any {
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      return JSON.stringify(maskSensitiveData(parsed));
    } catch {
      return data;
    }
  }
  return maskSensitiveData(data);
}
