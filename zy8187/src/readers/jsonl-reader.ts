import * as fs from 'fs';
import { Transaction, ValidationIssue } from '../types';

export async function readJsonlFile(filePath: string): Promise<Transaction[]> {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const lines = fileContent.split('\n').filter(line => line.trim() !== '');
    
    const transactions: Transaction[] = [];
    const issues: ValidationIssue[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      try {
        const rawData = JSON.parse(line);
        const transaction = validateAndTransformTransaction(rawData, i + 1, issues);
        transactions.push(transaction);
      } catch (error) {
        issues.push({
          severity: 'error',
          category: 'data_format',
          message: `第 ${i + 1} 行 JSON 解析失败: ${(error as Error).message}`,
          lineNumber: i + 1
        });
      }
    }
    
    if (issues.length > 0) {
      console.warn(`数据文件中发现 ${issues.length} 个问题:`);
      issues.forEach(issue => {
        console.warn(`  [${issue.severity.toUpperCase()}] ${issue.message}`);
      });
    }
    
    return transactions;
  } catch (error) {
    throw new Error(`读取 JSONL 文件失败: ${(error as Error).message}`);
  }
}

function validateAndTransformTransaction(raw: any, lineNumber: number, issues: ValidationIssue[]): Transaction {
  const transaction: Transaction = {
    id: validateField(raw, 'id', 'string', lineNumber, issues) || `TXN_${Date.now()}_${lineNumber}`,
    date: validateField(raw, 'date', 'string', lineNumber, issues) || new Date().toISOString().split('T')[0],
    time: validateField(raw, 'time', 'string', lineNumber, issues) || '00:00:00',
    cashier: validateField(raw, 'cashier', 'string', lineNumber, issues) || 'Unknown',
    items: validateItems(raw.items, lineNumber, issues),
    subtotal: validateField(raw, 'subtotal', 'number', lineNumber, issues) || 0,
    tax: validateOptionalField(raw, 'tax', 'number', lineNumber, issues),
    discount: validateOptionalField(raw, 'discount', 'number', lineNumber, issues),
    total: validateField(raw, 'total', 'number', lineNumber, issues) || 0,
    payment: validatePayment(raw.payment, lineNumber, issues),
    customer: validateOptionalCustomer(raw.customer, lineNumber, issues),
    store: validateStore(raw.store, lineNumber, issues)
  };
  
  return transaction;
}

function validateField(raw: any, field: string, expectedType: string, lineNumber: number, issues: ValidationIssue[]): any {
  if (raw[field] === undefined || raw[field] === null) {
    issues.push({
      severity: 'warning',
      category: 'missing_field',
      field,
      message: `交易记录第 ${lineNumber} 行缺少必填字段: ${field}`,
      lineNumber
    });
    return undefined;
  }
  
  if (typeof raw[field] !== expectedType) {
    issues.push({
      severity: 'warning',
      category: 'field_type',
      field,
      message: `交易记录第 ${lineNumber} 行字段 ${field} 类型错误，期望 ${expectedType}，实际 ${typeof raw[field]}`,
      lineNumber
    });
  }
  
  return raw[field];
}

function validateOptionalField(raw: any, field: string, expectedType: string, lineNumber: number, issues: ValidationIssue[]): any {
  if (raw[field] === undefined || raw[field] === null) {
    return undefined;
  }
  
  if (typeof raw[field] !== expectedType) {
    issues.push({
      severity: 'info',
      category: 'field_type',
      field,
      message: `交易记录第 ${lineNumber} 行可选字段 ${field} 类型错误，期望 ${expectedType}`,
      lineNumber
    });
  }
  
  return raw[field];
}

function validateItems(rawItems: any, lineNumber: number, issues: ValidationIssue[]): any[] {
  if (!Array.isArray(rawItems)) {
    issues.push({
      severity: 'error',
      category: 'field_type',
      field: 'items',
      message: `交易记录第 ${lineNumber} 行 items 必须是数组`,
      lineNumber
    });
    return [];
  }
  
  return rawItems.map((item: any, index: number) => {
    const validatedItem: any = {
      name: item.name || `商品 ${index + 1}`,
      quantity: item.quantity || 1,
      price: item.price || 0,
      subtotal: item.subtotal || (item.quantity || 1) * (item.price || 0),
      category: item.category
    };
    
    const nameWidth = calculateTextWidth(validatedItem.name);
    if (nameWidth > 20) {
      issues.push({
        severity: 'warning',
        category: 'long_name',
        field: 'items.name',
        message: `交易记录第 ${lineNumber} 行，商品 ${index + 1} 名称过长 (${nameWidth} 字符宽度)，可能导致排版问题`,
        lineNumber
      });
    }
    
    return validatedItem;
  });
}

function validatePayment(rawPayment: any, lineNumber: number, issues: ValidationIssue[]): any {
  if (!rawPayment) {
    issues.push({
      severity: 'warning',
      category: 'missing_field',
      field: 'payment',
      message: `交易记录第 ${lineNumber} 行缺少 payment 信息`,
      lineNumber
    });
    return { method: 'Unknown', amount: 0 };
  }
  
  return {
    method: rawPayment.method || 'Unknown',
    amount: rawPayment.amount || 0,
    change: rawPayment.change,
    cardInfo: rawPayment.cardInfo
  };
}

function validateOptionalCustomer(rawCustomer: any, lineNumber: number, issues: ValidationIssue[]): any {
  if (!rawCustomer) {
    return undefined;
  }
  
  return {
    name: rawCustomer.name,
    phone: rawCustomer.phone,
    memberId: rawCustomer.memberId
  };
}

function validateStore(rawStore: any, lineNumber: number, issues: ValidationIssue[]): any {
  if (!rawStore) {
    issues.push({
      severity: 'warning',
      category: 'missing_field',
      field: 'store',
      message: `交易记录第 ${lineNumber} 行缺少 store 信息`,
      lineNumber
    });
    return { name: 'Unknown Store', address: '', phone: '' };
  }
  
  return {
    name: rawStore.name || 'Unknown Store',
    address: rawStore.address || '',
    phone: rawStore.phone || ''
  };
}

function calculateTextWidth(text: string): number {
  let width = 0;
  for (const char of text) {
    const charCode = char.charCodeAt(0);
    if (charCode >= 0x4e00 && charCode <= 0x9fff || 
        charCode >= 0x3040 && charCode <= 0x30ff ||
        charCode >= 0xff00 && charCode <= 0xffef) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
}