import { CertificateType } from '../types';

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidDate(dateString: string): boolean {
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

export function isValidCertificateType(type: string): type is CertificateType {
  return Object.values(CertificateType).includes(type as CertificateType);
}

export function normalizeDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toISOString().split('T')[0];
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function sanitizeString(input: string): string {
  return input.trim().replace(/[<>]+/g, '');
}

export function validateCertificateData(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!data.name || data.name.trim() === '') {
    errors.push('证书名称不能为空');
  }
  
  if (!data.type || !isValidCertificateType(data.type)) {
    errors.push(`证书类型无效，有效值为：${Object.values(CertificateType).join(', ')}`);
  }
  
  if (!data.issueDate) {
    errors.push('颁发日期不能为空');
  } else if (!isValidDate(data.issueDate)) {
    errors.push('颁发日期格式无效');
  }
  
  if (!data.expiryDate) {
    errors.push('到期日期不能为空');
  } else if (!isValidDate(data.expiryDate)) {
    errors.push('到期日期格式无效');
  }
  
  if (data.issueDate && data.expiryDate && isValidDate(data.issueDate) && isValidDate(data.expiryDate)) {
    const issueDate = new Date(data.issueDate);
    const expiryDate = new Date(data.expiryDate);
    if (expiryDate <= issueDate) {
      errors.push('到期日期必须晚于颁发日期');
    }
  }
  
  if (data.ownerEmail && !isValidEmail(data.ownerEmail)) {
    errors.push('责任人邮箱格式无效');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
