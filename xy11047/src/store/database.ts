import { v4 as uuidv4 } from 'uuid';
import { DepositDeduction, Order, AuditLog, DepositDeductionStatus } from '../types';
import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const DEDUCTIONS_FILE = path.join(DATA_DIR, 'deductions.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const AUDIT_LOGS_FILE = path.join(DATA_DIR, 'audit-logs.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJsonFile<T>(filePath: string, defaultValue: T): T {
  ensureDataDir();
  if (!fs.existsSync(filePath)) {
    return defaultValue;
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return defaultValue;
  }
}

function writeJsonFile<T>(filePath: string, data: T): void {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export class Database {
  private deductions: DepositDeduction[] = [];
  private orders: Order[] = [];
  private auditLogs: AuditLog[] = [];

  load() {
    this.deductions = readJsonFile(DEDUCTIONS_FILE, []);
    this.orders = readJsonFile(ORDERS_FILE, []);
    this.auditLogs = readJsonFile(AUDIT_LOGS_FILE, []);
  }

  save() {
    writeJsonFile(DEDUCTIONS_FILE, this.deductions);
    writeJsonFile(ORDERS_FILE, this.orders);
    writeJsonFile(AUDIT_LOGS_FILE, this.auditLogs);
  }

  clear() {
    this.deductions = [];
    this.orders = [];
    this.auditLogs = [];
    this.save();
  }

  getDeductions(): DepositDeduction[] {
    return this.deductions;
  }

  getDeductionById(id: string): DepositDeduction | undefined {
    return this.deductions.find(d => d.id === id);
  }

  getDeductionsByOrderId(orderId: string): DepositDeduction[] {
    return this.deductions.filter(d => d.orderId === orderId && d.status !== DepositDeductionStatus.CANCELLED);
  }

  addDeduction(deduction: Omit<DepositDeduction, 'id' | 'createTime' | 'updateTime'>): DepositDeduction {
    const now = new Date();
    const newDeduction: DepositDeduction = {
      ...deduction,
      id: uuidv4(),
      createTime: now,
      updateTime: now
    };
    this.deductions.push(newDeduction);
    this.save();
    return newDeduction;
  }

  updateDeduction(id: string, updates: Partial<DepositDeduction>): DepositDeduction | undefined {
    const index = this.deductions.findIndex(d => d.id === id);
    if (index === -1) return undefined;
    
    this.deductions[index] = {
      ...this.deductions[index],
      ...updates,
      updateTime: new Date()
    };
    this.save();
    return this.deductions[index];
  }

  getOrders(): Order[] {
    return this.orders;
  }

  getOrderById(id: string): Order | undefined {
    return this.orders.find(o => o.id === id);
  }

  getOrderByNo(orderNo: string): Order | undefined {
    return this.orders.find(o => o.orderNo === orderNo);
  }

  addOrder(order: Omit<Order, 'id' | 'createTime'>): Order {
    const newOrder: Order = {
      ...order,
      id: uuidv4(),
      createTime: new Date()
    };
    this.orders.push(newOrder);
    this.save();
    return newOrder;
  }

  updateOrder(id: string, updates: Partial<Order>): Order | undefined {
    const index = this.orders.findIndex(o => o.id === id);
    if (index === -1) return undefined;
    
    this.orders[index] = {
      ...this.orders[index],
      ...updates
    };
    this.save();
    return this.orders[index];
  }

  getAuditLogs(deductionId?: string): AuditLog[] {
    if (deductionId) {
      return this.auditLogs.filter(log => log.deductionId === deductionId);
    }
    return this.auditLogs;
  }

  addAuditLog(log: Omit<AuditLog, 'id' | 'operateTime'>): AuditLog {
    const newLog: AuditLog = {
      ...log,
      id: uuidv4(),
      operateTime: new Date()
    };
    this.auditLogs.push(newLog);
    this.save();
    return newLog;
  }

  generateDeductionNo(): string {
    const date = new Date();
    const dateStr = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
    const count = this.deductions.filter(d => d.deductionNo.startsWith(`DK${dateStr}`)).length + 1;
    return `DK${dateStr}${count.toString().padStart(4, '0')}`;
  }

  generateOrderNo(): string {
    const date = new Date();
    const dateStr = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
    const count = this.orders.filter(o => o.orderNo.startsWith(`ORD${dateStr}`)).length + 1;
    return `ORD${dateStr}${count.toString().padStart(4, '0')}`;
  }
}

export const db = new Database();