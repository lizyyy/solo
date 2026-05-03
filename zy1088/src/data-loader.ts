import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import {
  Sale,
  Payment,
  Inventory,
  InventoryItem,
  InventoryRecord,
  Fee,
  Return,
  Config,
  LoadedData
} from './types';
import { loadConfig } from './config';

export function loadAllData(inputDir: string, configPath?: string): LoadedData {
  const config = loadConfig(configPath);
  
  const sales = loadSales(inputDir);
  const payments = loadPayments(inputDir);
  const inventory = loadInventory(inputDir);
  const fees = loadFees(inputDir);
  const returns = loadReturns(inputDir);
  
  return {
    sales,
    payments,
    inventory,
    fees,
    returns,
    config
  };
}

export function loadSales(inputDir: string): Sale[] {
  const filePath = path.join(inputDir, 'sales.csv');
  
  if (!fs.existsSync(filePath)) {
    console.warn(`Warning: sales.csv not found in ${inputDir}`);
    return [];
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });
  
  return records.map((record: any, index: number) => parseSale(record, index + 2));
}

function parseSale(record: any, lineNumber: number): Sale {
  const sale: Sale = {
    orderId: record.orderId || record.order_id || `ORD-${lineNumber}`,
    timestamp: record.timestamp || record.time || record.date,
    date: record.date || extractDate(record.timestamp || record.time || ''),
    stallId: record.stallId || record.stall_id || 'stall-001',
    stallName: record.stallName || record.stall_name || '',
    productId: record.productId || record.product_id || '',
    productName: record.productName || record.product_name || record.product || '',
    quantity: parseNumber(record.quantity, 1),
    unitPrice: parseNumber(record.unitPrice || record.unit_price || record.price, 0),
    totalAmount: parseNumber(record.totalAmount || record.total_amount || record.amount, 0),
    paymentMethod: parsePaymentMethod(record.paymentMethod || record.payment_method || record.method),
    paymentId: record.paymentId || record.payment_id || undefined,
    notes: record.notes || record.note || undefined
  };
  
  if (sale.totalAmount === 0 && sale.unitPrice > 0 && sale.quantity > 0) {
    sale.totalAmount = sale.unitPrice * sale.quantity;
  }
  
  return sale;
}

export function loadPayments(inputDir: string): Payment[] {
  const filePath = path.join(inputDir, 'payments.csv');
  
  if (!fs.existsSync(filePath)) {
    console.warn(`Warning: payments.csv not found in ${inputDir}`);
    return [];
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });
  
  return records.map((record: any, index: number) => parsePayment(record, index + 2));
}

function parsePayment(record: any, lineNumber: number): Payment {
  return {
    paymentId: record.paymentId || record.payment_id || `PAY-${lineNumber}`,
    orderId: record.orderId || record.order_id || undefined,
    timestamp: record.timestamp || record.time || record.date,
    date: record.date || extractDate(record.timestamp || record.time || ''),
    stallId: record.stallId || record.stall_id || 'stall-001',
    amount: parseNumber(record.amount || record.totalAmount || record.total_amount, 0),
    method: parsePaymentMethod(record.method || record.paymentMethod || record.payment_method),
    status: parsePaymentStatus(record.status || 'success'),
    fee: record.fee !== undefined ? parseNumber(record.fee, 0) : undefined,
    notes: record.notes || record.note || undefined
  };
}

export function loadInventory(inputDir: string): Inventory {
  const filePath = path.join(inputDir, 'inventory.json');
  
  if (!fs.existsSync(filePath)) {
    console.warn(`Warning: inventory.json not found in ${inputDir}`);
    return { items: [], records: [] };
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);
  
  return {
    items: (data.items || []).map(parseInventoryItem),
    records: (data.records || []).map(parseInventoryRecord)
  };
}

function parseInventoryItem(item: any): InventoryItem {
  return {
    productId: item.productId || item.product_id || '',
    productName: item.productName || item.product_name || item.name || '',
    category: item.category || 'uncategorized',
    unitCost: parseNumber(item.unitCost || item.unit_cost || item.cost, 0),
    unitPrice: parseNumber(item.unitPrice || item.unit_price || item.price, 0),
    initialStock: parseNumber(item.initialStock || item.initial_stock, 0),
    currentStock: parseNumber(item.currentStock || item.current_stock, 0),
    minStock: parseNumber(item.minStock || item.min_stock, 0),
    unit: item.unit || '件',
    supplier: item.supplier || undefined,
    lastRestockDate: item.lastRestockDate || item.last_restock_date || undefined
  };
}

function parseInventoryRecord(record: any): InventoryRecord {
  return {
    recordId: record.recordId || record.record_id || '',
    timestamp: record.timestamp || record.time || record.date,
    date: record.date || extractDate(record.timestamp || record.time || ''),
    stallId: record.stallId || record.stall_id || 'stall-001',
    type: parseInventoryRecordType(record.type || 'adjustment'),
    productId: record.productId || record.product_id || '',
    productName: record.productName || record.product_name || '',
    quantity: parseNumber(record.quantity, 0),
    unitCost: parseNumber(record.unitCost || record.unit_cost, 0),
    totalCost: parseNumber(record.totalCost || record.total_cost, 0),
    reason: record.reason || undefined,
    relatedOrderId: record.relatedOrderId || record.related_order_id || undefined,
    notes: record.notes || record.note || undefined
  };
}

export function loadFees(inputDir: string): Fee[] {
  const filePath = path.join(inputDir, 'fees.csv');
  
  if (!fs.existsSync(filePath)) {
    console.warn(`Warning: fees.csv not found in ${inputDir}`);
    return [];
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });
  
  return records.map((record: any, index: number) => parseFee(record, index + 2));
}

function parseFee(record: any, lineNumber: number): Fee {
  return {
    feeId: record.feeId || record.fee_id || `FEE-${lineNumber}`,
    date: record.date || extractDate(record.timestamp || record.time || ''),
    stallId: record.stallId || record.stall_id || 'stall-001',
    stallName: record.stallName || record.stall_name || '',
    type: parseFeeType(record.type || 'other'),
    amount: parseNumber(record.amount || record.totalAmount || record.total_amount, 0),
    description: record.description || record.desc || '',
    paidBy: record.paidBy || record.paid_by || undefined,
    paymentMethod: record.paymentMethod || record.payment_method || undefined,
    notes: record.notes || record.note || undefined
  };
}

export function loadReturns(inputDir: string): Return[] {
  const filePath = path.join(inputDir, 'returns.csv');
  
  if (!fs.existsSync(filePath)) {
    console.warn(`Warning: returns.csv not found in ${inputDir}`);
    return [];
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });
  
  return records.map((record: any, index: number) => parseReturn(record, index + 2));
}

function parseReturn(record: any, lineNumber: number): Return {
  return {
    returnId: record.returnId || record.return_id || `RET-${lineNumber}`,
    timestamp: record.timestamp || record.time || record.date,
    date: record.date || extractDate(record.timestamp || record.time || ''),
    stallId: record.stallId || record.stall_id || 'stall-001',
    originalOrderId: record.originalOrderId || record.original_order_id || record.orderId || record.order_id || '',
    productId: record.productId || record.product_id || '',
    productName: record.productName || record.product_name || '',
    quantity: parseNumber(record.quantity, 1),
    refundAmount: parseNumber(record.refundAmount || record.refund_amount || record.amount, 0),
    reason: record.reason || '',
    paymentMethod: parsePaymentMethod(record.paymentMethod || record.payment_method || record.method),
    refundId: record.refundId || record.refund_id || undefined,
    notes: record.notes || record.note || undefined
  };
}

function parseNumber(value: any, defaultValue: number): number {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  const parsed = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
  return isNaN(parsed) ? defaultValue : parsed;
}

function parsePaymentMethod(value: string): 'wechat' | 'alipay' | 'cash' | 'other' {
  const lower = String(value).toLowerCase().trim();
  if (lower.includes('wechat') || lower.includes('微信') || lower === 'wx' || lower === 'weixin') {
    return 'wechat';
  }
  if (lower.includes('alipay') || lower.includes('支付宝') || lower === 'ali' || lower === 'zfb') {
    return 'alipay';
  }
  if (lower.includes('cash') || lower.includes('现金') || lower === 'xianjin') {
    return 'cash';
  }
  return 'other';
}

function parsePaymentStatus(value: string): 'success' | 'pending' | 'failed' | 'refunded' {
  const lower = String(value).toLowerCase().trim();
  if (lower === 'success' || lower === '成功' || lower === 'succeeded' || lower === 'completed') {
    return 'success';
  }
  if (lower === 'pending' || lower === '处理中' || lower === '待处理') {
    return 'pending';
  }
  if (lower === 'failed' || lower === '失败' || lower === 'cancelled' || lower === 'canceled') {
    return 'failed';
  }
  if (lower === 'refunded' || lower === '已退款' || lower === '退款') {
    return 'refunded';
  }
  return 'success';
}

function parseInventoryRecordType(value: string): 'restock' | 'sale' | 'damage' | 'return' | 'adjustment' {
  const lower = String(value).toLowerCase().trim();
  if (lower === 'restock' || lower === '进货' || lower === '补货') {
    return 'restock';
  }
  if (lower === 'sale' || lower === '销售' || lower === '售出') {
    return 'sale';
  }
  if (lower === 'damage' || lower === '损耗' || lower === '损坏') {
    return 'damage';
  }
  if (lower === 'return' || lower === '退货' || lower === '退回') {
    return 'return';
  }
  return 'adjustment';
}

function parseFeeType(value: string): 'rental' | 'utility' | 'cleaning' | 'marketing' | 'other' {
  const lower = String(value).toLowerCase().trim();
  if (lower === 'rental' || lower === '租金' || lower === '摊位费' || lower === 'rent') {
    return 'rental';
  }
  if (lower === 'utility' || lower === '水电费' || lower === '水电' || lower === 'utilities') {
    return 'utility';
  }
  if (lower === 'cleaning' || lower === '清洁费' || lower === '保洁') {
    return 'cleaning';
  }
  if (lower === 'marketing' || lower === '营销费' || lower === '推广' || lower === '广告') {
    return 'marketing';
  }
  return 'other';
}

function extractDate(timestamp: string): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) {
    return timestamp.split('T')[0] || timestamp.split(' ')[0] || '';
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
