import { LabValue } from '../models/types';

export interface ValidationError {
  field: string;
  message: string;
  suggestion: string;
}

export interface ValidationResult<T> {
  isValid: boolean;
  data?: T;
  errors: ValidationError[];
}

export function validateLabValue(data: Record<string, unknown>): ValidationResult<LabValue> {
  const errors: ValidationError[] = [];
  
  const L = parseFloat(data.L as string);
  const a = parseFloat(data.a as string);
  const b = parseFloat(data.b as string);

  if (data.L === undefined || data.L === null || data.L === '') {
    errors.push({
      field: 'L',
      message: 'L值不能为空',
      suggestion: '请输入0-100之间的数值',
    });
  } else if (isNaN(L)) {
    errors.push({
      field: 'L',
      message: `L值 "${data.L}" 不是有效数字`,
      suggestion: '请输入有效的数字，例如: 85.5',
    });
  } else if (L < 0 || L > 100) {
    errors.push({
      field: 'L',
      message: `L值 ${L} 超出有效范围(0-100)`,
      suggestion: '请输入0到100之间的数值',
    });
  }

  if (data.a === undefined || data.a === null || data.a === '') {
    errors.push({
      field: 'a',
      message: 'a值不能为空',
      suggestion: '请输入-128到127之间的数值',
    });
  } else if (isNaN(a)) {
    errors.push({
      field: 'a',
      message: `a值 "${data.a}" 不是有效数字`,
      suggestion: '请输入有效的数字，例如: 12.3',
    });
  } else if (a < -128 || a > 127) {
    errors.push({
      field: 'a',
      message: `a值 ${a} 超出有效范围(-128到127)`,
      suggestion: '请输入-128到127之间的数值',
    });
  }

  if (data.b === undefined || data.b === null || data.b === '') {
    errors.push({
      field: 'b',
      message: 'b值不能为空',
      suggestion: '请输入-128到127之间的数值',
    });
  } else if (isNaN(b)) {
    errors.push({
      field: 'b',
      message: `b值 "${data.b}" 不是有效数字`,
      suggestion: '请输入有效的数字，例如: -5.2',
    });
  } else if (b < -128 || b > 127) {
    errors.push({
      field: 'b',
      message: `b值 ${b} 超出有效范围(-128到127)`,
      suggestion: '请输入-128到127之间的数值',
    });
  }

  return {
    isValid: errors.length === 0,
    data: errors.length === 0 ? { L, a, b } : undefined,
    errors,
  };
}

export function validateBatchId(batchId: unknown): ValidationResult<string> {
  const errors: ValidationError[] = [];
  
  if (!batchId || String(batchId).trim() === '') {
    errors.push({
      field: 'batchId',
      message: '批次号不能为空',
      suggestion: '请输入批次号，例如: BATCH-2024-001',
    });
  } else if (String(batchId).length > 50) {
    errors.push({
      field: 'batchId',
      message: '批次号长度不能超过50个字符',
      suggestion: '请缩短批次号长度',
    });
  }

  return {
    isValid: errors.length === 0,
    data: errors.length === 0 ? String(batchId).trim() : undefined,
    errors,
  };
}

export function validateOrderId(orderId: unknown): ValidationResult<string> {
  const errors: ValidationError[] = [];
  
  if (!orderId || String(orderId).trim() === '') {
    errors.push({
      field: 'orderId',
      message: '订单号不能为空',
      suggestion: '请输入订单号，例如: ORDER-2024-001',
    });
  } else if (String(orderId).length > 50) {
    errors.push({
      field: 'orderId',
      message: '订单号长度不能超过50个字符',
      suggestion: '请缩短订单号长度',
    });
  }

  return {
    isValid: errors.length === 0,
    data: errors.length === 0 ? String(orderId).trim() : undefined,
    errors,
  };
}

export function validatePaperBatch(paperBatch: unknown): ValidationResult<string> {
  const errors: ValidationError[] = [];
  
  if (!paperBatch || String(paperBatch).trim() === '') {
    errors.push({
      field: 'paperBatch',
      message: '纸张批次不能为空',
      suggestion: '请输入纸张批次，例如: PAPER-A001',
    });
  }

  return {
    isValid: errors.length === 0,
    data: errors.length === 0 ? String(paperBatch).trim() : undefined,
    errors,
  };
}

export function validateDate(dateStr: unknown): ValidationResult<Date> {
  const errors: ValidationError[] = [];
  
  if (!dateStr) {
    errors.push({
      field: 'measuredAt',
      message: '测量时间不能为空',
      suggestion: '请输入测量时间，格式: YYYY-MM-DD HH:mm:ss',
    });
    return { isValid: false, errors };
  }

  const date = new Date(String(dateStr));
  if (isNaN(date.getTime())) {
    errors.push({
      field: 'measuredAt',
      message: `"${dateStr}" 不是有效的日期格式`,
      suggestion: '请使用正确的日期格式，例如: 2024-01-15 14:30:00',
    });
  }

  return {
    isValid: errors.length === 0,
    data: errors.length === 0 ? date : undefined,
    errors,
  };
}

export function validateUser(operator: unknown, role: unknown): ValidationResult<{ operator: string; role: string }> {
  const errors: ValidationError[] = [];
  
  if (!operator || String(operator).trim() === '') {
    errors.push({
      field: 'operator',
      message: '操作人不能为空',
      suggestion: '请输入操作人姓名',
    });
  }

  if (!role || String(role).trim() === '') {
    errors.push({
      field: 'role',
      message: '角色不能为空',
      suggestion: '请输入角色，例如: 品控员、质检员',
    });
  }

  return {
    isValid: errors.length === 0,
    data: errors.length === 0 ? { operator: String(operator).trim(), role: String(role).trim() } : undefined,
    errors,
  };
}
