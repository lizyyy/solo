import * as crypto from 'crypto';

export function generateChecksum(data: any): string {
  const normalized = JSON.stringify(normalizeObject(data));
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function normalizeObject(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(normalizeObject).sort();
  if (typeof obj === 'object') {
    return Object.keys(obj)
      .sort()
      .reduce((result: any, key) => {
        result[key] = normalizeObject(obj[key]);
        return result;
      }, {});
  }
  return obj;
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function anonymizeValue(value: string, type: 'phone' | 'name' | 'id' | 'email'): string {
  if (!value) return value;
  
  switch (type) {
    case 'phone':
      return value.slice(0, 3) + '****' + value.slice(-4);
    case 'name':
      if (value.length <= 1) return '*';
      return value[0] + '*'.repeat(value.length - 1);
    case 'id':
      return value.slice(0, 6) + '********' + value.slice(-4);
    case 'email':
      const [name, domain] = value.split('@');
      return name[0] + '***@' + domain;
    default:
      return '***';
  }
}

export function generateFactKey(pileId: string, eventTime: string, eventType: string): string {
  const timeKey = new Date(eventTime).toISOString().slice(0, 13);
  return `${pileId}:${timeKey}:${eventType}`;
}
