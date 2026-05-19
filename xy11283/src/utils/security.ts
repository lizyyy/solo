const SENSITIVE_FIELDS = {
  patient_id: 'mask_id',
  patient_name: 'mask_name',
  doctor_id: 'mask_id',
  doctor_name: 'mask_name',
  phone: 'mask_phone',
  email: 'mask_email',
  address: 'mask_address',
  id_card: 'mask_id_card',
  operator_id: 'mask_id',
  operator_name: 'mask_name',
};

export function maskId(value: string): string {
  if (!value || value.length <= 4) return '****';
  return value.slice(0, 2) + '*'.repeat(value.length - 4) + value.slice(-2);
}

export function maskName(value: string): string {
  if (!value) return '';
  if (value.length === 1) return '*';
  if (value.length === 2) return value[0] + '*';
  return value[0] + '*'.repeat(value.length - 2) + value[value.length - 1];
}

export function maskPhone(value: string): string {
  if (!value || value.length < 7) return '****';
  return value.slice(0, 3) + '****' + value.slice(-4);
}

export function maskEmail(value: string): string {
  if (!value || !value.includes('@')) return '****';
  const [name, domain] = value.split('@');
  if (name.length <= 2) return '***@' + domain;
  return name.slice(0, 2) + '***@' + domain;
}

export function maskAddress(value: string): string {
  if (!value || value.length <= 6) return '******';
  return value.slice(0, 3) + '***' + value.slice(-3);
}

export function maskIdCard(value: string): string {
  if (!value || value.length < 10) return '**********';
  return value.slice(0, 4) + '**********' + value.slice(-4);
}

const maskFunctions: Record<string, (value: string) => string> = {
  mask_id: maskId,
  mask_name: maskName,
  mask_phone: maskPhone,
  mask_email: maskEmail,
  mask_address: maskAddress,
  mask_id_card: maskIdCard,
};

export function maskSensitiveData<T>(data: T, fields: Record<string, string> = SENSITIVE_FIELDS): T {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => maskSensitiveData(item, fields)) as unknown as T;
  }

  const result: Record<string, any> = { ...data };

  for (const [key, maskType] of Object.entries(fields)) {
    if (key in result && typeof result[key] === 'string') {
      const maskFn = maskFunctions[maskType];
      if (maskFn) {
        result[key] = maskFn(result[key]);
      }
    }
  }

  return result as T;
}

export function sanitizeLog(data: any): string {
  const masked = maskSensitiveData(data);
  return JSON.stringify(masked);
}
