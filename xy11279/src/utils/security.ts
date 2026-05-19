export function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) return '***';
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}

export function maskEmployeeId(employeeId: string): string {
  if (!employeeId || employeeId.length < 4) return '***';
  return employeeId.slice(0, 2) + '**' + employeeId.slice(-2);
}

export function maskSensitiveData<T>(data: T): T {
  const masked = { ...data } as Record<string, unknown>;
  
  if (masked.phone && typeof masked.phone === 'string') {
    masked.phone = maskPhone(masked.phone);
  }
  
  if (masked.employeeId && typeof masked.employeeId === 'string') {
    masked.employeeId = maskEmployeeId(masked.employeeId);
  }
  
  if ('_sensitive' in masked) {
    delete masked._sensitive;
  }
  
  if (masked.operatorPhone && typeof masked.operatorPhone === 'string') {
    masked.operatorPhone = maskPhone(masked.operatorPhone);
  }
  
  return masked as T;
}

export function sanitizeLog(data: unknown): string {
  const str = JSON.stringify(data);
  return str.replace(/\d{11}/g, (match) => maskPhone(match));
}
