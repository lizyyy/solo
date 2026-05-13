import { randomUUID } from 'crypto';
import { format } from 'date-fns';
import { InvoiceType, InvoiceStatus } from '../types/invoice';

export function generateId(): string {
  return randomUUID();
}

export function generateBatchId(): string {
  const timestamp = Date.now();
  const randomPart = randomUUID().substring(0, 8).toUpperCase();
  return `BATCH-${timestamp}-${randomPart}`;
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'yyyy-MM-dd HH:mm:ss');
}

export function normalizeInvoiceType(type: string): InvoiceType {
  const normalized = type.trim();
  const typeMap: Record<string, InvoiceType> = {
    '专用发票': '增值税专用发票',
    '增值税专票': '增值税专用发票',
    '普通发票': '增值税普通发票',
    '增值税普票': '增值税普通发票',
    '电子发票': '电子普通发票',
    '电子普票': '电子普通发票',
    '电子专票': '电子专用发票',
    '机动车发票': '机动车销售统一发票',
    '二手车发票': '二手车销售统一发票',
  };
  
  return typeMap[normalized] || (normalized as InvoiceType);
}

export function normalizeInvoiceStatus(status: string): InvoiceStatus {
  const normalized = status.trim();
  const statusMap: Record<string, InvoiceStatus> = {
    '正常': '正常',
    'valid': '正常',
    '有效': '正常',
    '作废': '作废',
    'void': '作废',
    '红冲': '红冲',
    'red': '红冲',
    '负数': '红冲',
    '异常': '异常',
    'abnormal': '异常',
    '待核验': '待核验',
    'pending': '待核验',
  };
  
  return statusMap[normalized] || '待核验';
}

export function sanitizeNumber(value: any): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[,\s￥¥]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

export function isPositiveAmount(amount: number): boolean {
  return amount > 0;
}

export function isNegativeAmount(amount: number): boolean {
  return amount < 0;
}

export function calculateTotalAmount(amount: number, taxAmount: number): number {
  return amount + taxAmount;
}

export function normalizeInvoiceNumber(number: string): string {
  return number.trim().replace(/\s+/g, '').toUpperCase();
}

export function normalizeInvoiceCode(code: string): string {
  return code.trim().replace(/\s+/g, '');
}

export function isValidInvoiceNumber(number: string): boolean {
  if (!number) return false;
  const normalized = normalizeInvoiceNumber(number);
  return /^[0-9A-Z]{8,20}$/.test(normalized);
}

export function isValidInvoiceCode(code: string): boolean {
  if (!code) return false;
  const normalized = normalizeInvoiceCode(code);
  return /^[0-9]{10,12}$/.test(normalized);
}

export function isValidDate(dateStr: string): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

export function isRedInvoiceSignaled(data: Record<string, any>): boolean {
  const positiveKeywords = ['红冲', '红票', '负数', '红字', 'red', 'negative'];
  
  const booleanFields = ['isRedInvoice', '是否红冲', '红冲', '红字'];
  const statusFields = ['status', '状态'];
  
  let hasExplicitNegativeSignal = false;
  let hasExplicitPositiveSignal = false;
  let hasNegativeAmount = false;
  
  for (const field of booleanFields) {
    const value = data[field];
    if (value === undefined || value === null || value === '') continue;
    
    if (typeof value === 'boolean') {
      if (value) {
        hasExplicitNegativeSignal = true;
      } else {
        hasExplicitPositiveSignal = true;
      }
    } else if (typeof value === 'number') {
      if (value === 1) {
        hasExplicitNegativeSignal = true;
      } else if (value === 0) {
        hasExplicitPositiveSignal = true;
      }
    } else if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === '否' || normalized === 'false' || normalized === 'no' || normalized === 'n' || normalized === '0') {
        hasExplicitPositiveSignal = true;
      }
      if (normalized === '是' || normalized === 'true' || normalized === 'yes' || normalized === 'y' || normalized === '1') {
        hasExplicitNegativeSignal = true;
      }
      if (positiveKeywords.some(kw => normalized.includes(kw.toLowerCase()))) {
        hasExplicitNegativeSignal = true;
      }
    }
  }
  
  if (hasExplicitPositiveSignal && !hasExplicitNegativeSignal) {
    return false;
  }
  
  const amountFields = [
    'amount', 'totalAmount', '金额', '价税合计', '合计', '总额', 'total'
  ];
  
  for (const field of amountFields) {
    const value = data[field];
    if (value !== undefined && value !== null) {
      const num = sanitizeNumber(value);
      if (isNegativeAmount(num)) {
        hasNegativeAmount = true;
        break;
      }
    }
  }
  
  if (hasNegativeAmount || hasExplicitNegativeSignal) {
    return true;
  }
  
  for (const field of statusFields) {
    const value = data[field];
    if (value === undefined || value === null || value === '') continue;
    
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (positiveKeywords.some(kw => normalized.includes(kw.toLowerCase()))) {
        return true;
      }
    }
  }
  
  return false;
}

export function createInvoiceKey(invoiceCode: string, invoiceNumber: string): string {
  const code = normalizeInvoiceCode(invoiceCode);
  const number = normalizeInvoiceNumber(invoiceNumber);
  return `${code}-${number}`;
}
