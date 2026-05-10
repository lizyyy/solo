import fs from 'fs';
import path from 'path';
import {
  Channel, Store, MenuItem, MenuVersion, Inventory,
  ChannelStatus, StatusHistory, RecoveryTask, ReconciliationJob, AuditLog
} from '../types';

const DB_DIR = process.env.DB_PATH || path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'database.json');

interface DatabaseSchema {
  channels: Channel[];
  stores: Store[];
  menuItems: MenuItem[];
  menuVersions: MenuVersion[];
  inventories: Inventory[];
  channelStatuses: ChannelStatus[];
  statusHistory: StatusHistory[];
  recoveryTasks: RecoveryTask[];
  reconciliationJobs: ReconciliationJob[];
  auditLogs: AuditLog[];
}

const defaultDB: DatabaseSchema = {
  channels: [],
  stores: [],
  menuItems: [],
  menuVersions: [],
  inventories: [],
  channelStatuses: [],
  statusHistory: [],
  recoveryTasks: [],
  reconciliationJobs: [],
  auditLogs: []
};

let db: DatabaseSchema;

const ensureDir = () => {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
};

const loadDB = (): DatabaseSchema => {
  ensureDir();
  if (!fs.existsSync(DB_FILE)) {
    return JSON.parse(JSON.stringify(defaultDB));
  }
  const content = fs.readFileSync(DB_FILE, 'utf-8');
  return JSON.parse(content);
};

const saveDB = () => {
  ensureDir();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
};

const seedData = () => {
  if (db.channels.length === 0) {
    const now = new Date().toISOString();
    
    db.channels = [
      { id: 'ch-001', name: '美团', code: 'meituan', isActive: true, createdAt: now },
      { id: 'ch-002', name: '饿了么', code: 'eleme', isActive: true, createdAt: now },
      { id: 'ch-003', name: '抖音', code: 'douyin', isActive: true, createdAt: now },
      { id: 'ch-004', name: '微信小程序', code: 'wechat', isActive: true, createdAt: now }
    ];
    
    db.stores = [
      { id: 'st-001', name: '朝阳门店', code: 'store-beijing-chao', address: '北京市朝阳区建国路88号', isActive: true, createdAt: now },
      { id: 'st-002', name: '海淀店', code: 'store-beijing-hai', address: '北京市海淀区中关村大街1号', isActive: true, createdAt: now }
    ];
    
    db.menuItems = [
      { id: 'item-001', name: '香辣鸡腿堡', code: 'burger-spicy', category: '汉堡', price: 28.00, description: '新鲜鸡腿肉配特制辣酱', createdAt: now },
      { id: 'item-002', name: '原味薯条', code: 'fries-original', category: '小食', price: 12.00, description: '比利时进口土豆现炸', createdAt: now },
      { id: 'item-003', name: '冰爽可乐', code: 'cola-ice', category: '饮料', price: 8.00, description: '冰爽可口可乐中杯', createdAt: now },
      { id: 'item-004', name: '奥尔良烤翅', code: 'wings-orleans', category: '小食', price: 18.00, description: '新奥尔良风味烤翅2对', createdAt: now }
    ];
    
    saveDB();
  }
};

db = loadDB();
seedData();

export const dbRepo = {
  get channels() { return db.channels; },
  get stores() { return db.stores; },
  get menuItems() { return db.menuItems; },
  get menuVersions() { return db.menuVersions; },
  get inventories() { return db.inventories; },
  get channelStatuses() { return db.channelStatuses; },
  get statusHistory() { return db.statusHistory; },
  get recoveryTasks() { return db.recoveryTasks; },
  get reconciliationJobs() { return db.reconciliationJobs; },
  get auditLogs() { return db.auditLogs; },
  
  addChannel(ch: Channel) { db.channels.push(ch); saveDB(); },
  addStore(st: Store) { db.stores.push(st); saveDB(); },
  addMenuItem(item: MenuItem) { db.menuItems.push(item); saveDB(); },
  addMenuVersion(v: MenuVersion) { db.menuVersions.push(v); saveDB(); },
  addInventory(inv: Inventory) { db.inventories.push(inv); saveDB(); },
  addChannelStatus(cs: ChannelStatus) { db.channelStatuses.push(cs); saveDB(); },
  addStatusHistory(h: StatusHistory) { db.statusHistory.push(h); saveDB(); },
  addRecoveryTask(t: RecoveryTask) { db.recoveryTasks.push(t); saveDB(); },
  addReconciliationJob(j: ReconciliationJob) { db.reconciliationJobs.push(j); saveDB(); },
  addAuditLog(l: AuditLog) { db.auditLogs.push(l); saveDB(); },
  
  save() { saveDB(); },
  
  prepare: (sql: string) => {
    return {
      get: (...params: any[]) => {
        console.warn('[WARN] sql.js fallback - prepare().get() not fully supported');
        return undefined;
      },
      all: (...params: any[]) => {
        console.warn('[WARN] sql.js fallback - prepare().all() not fully supported');
        return [];
      },
      run: (...params: any[]) => {
        console.warn('[WARN] sql.js fallback - prepare().run() not fully supported');
      }
    };
  }
};

export default dbRepo;
