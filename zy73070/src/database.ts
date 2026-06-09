import path from 'path';
import fs from 'fs';
import {
  WorkOrder,
  RawSensorLog,
  VerdictHistory,
  DuplicateDeviceAlert,
  AuditLog,
} from './types';

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'switchgear.json');

interface DBSchema {
  work_orders: WorkOrder[];
  raw_sensor_logs: RawSensorLog[];
  verdict_histories: VerdictHistory[];
  duplicate_device_alerts: DuplicateDeviceAlert[];
  audit_logs: AuditLog[];
}

const emptyDB: DBSchema = {
  work_orders: [],
  raw_sensor_logs: [],
  verdict_histories: [],
  duplicate_device_alerts: [],
  audit_logs: [],
};

let inMemory: DBSchema = loadFromDisk();

function loadFromDisk(): DBSchema {
  try {
    if (fs.existsSync(dbPath)) {
      const raw = fs.readFileSync(dbPath, 'utf-8');
      const parsed = JSON.parse(raw) as DBSchema;
      return {
        work_orders: parsed.work_orders || [],
        raw_sensor_logs: parsed.raw_sensor_logs || [],
        verdict_histories: parsed.verdict_histories || [],
        duplicate_device_alerts: parsed.duplicate_device_alerts || [],
        audit_logs: parsed.audit_logs || [],
      };
    }
  } catch (e) {
    console.warn('数据库文件损坏或不可读，使用空数据库启动。错误：', (e as Error).message);
  }
  return JSON.parse(JSON.stringify(emptyDB));
}

let flushScheduled = false;
let flushTimeout: NodeJS.Timeout | null = null;

function scheduleFlush() {
  if (flushScheduled) return;
  flushScheduled = true;
  if (flushTimeout) clearTimeout(flushTimeout);
  flushTimeout = setTimeout(() => {
    try {
      fs.writeFileSync(dbPath, JSON.stringify(inMemory, null, 2), 'utf-8');
    } catch (e) {
      console.error('持久化失败：', (e as Error).message);
    }
    flushScheduled = false;
  }, 50);
}

export function forceFlush() {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(inMemory, null, 2), 'utf-8');
  } catch (e) {
    console.error('强制持久化失败：', (e as Error).message);
  }
}

export type TableName = keyof DBSchema;

export function getTable<T extends TableName>(name: T): DBSchema[T][number][] {
  return inMemory[name] as any;
}

export function insertOne<T extends TableName>(
  name: T,
  record: DBSchema[T][number]
): DBSchema[T][number] {
  (inMemory[name] as any[]).push(record);
  scheduleFlush();
  return record;
}

export function findByField<T extends TableName>(
  name: T,
  field: string,
  value: any
): DBSchema[T][number] | undefined {
  return (inMemory[name] as any[]).find((r: any) => r[field] === value);
}

export function filterByField<T extends TableName>(
  name: T,
  field: string,
  value: any
): DBSchema[T][number][] {
  return (inMemory[name] as any[]).filter((r: any) => r[field] === value);
}

export function filterWhere<T extends TableName>(
  name: T,
  predicate: (r: any) => boolean
): DBSchema[T][number][] {
  return (inMemory[name] as any[]).filter(predicate);
}

export function updateOne<T extends TableName>(
  name: T,
  field: string,
  value: any,
  patch: Partial<DBSchema[T][number]>
): boolean {
  const table = inMemory[name] as any[];
  const idx = table.findIndex((r: any) => r[field] === value);
  if (idx === -1) return false;
  table[idx] = { ...table[idx], ...patch } as any;
  scheduleFlush();
  return true;
}

export function transaction<T>(fn: () => T): T {
  const result = fn();
  scheduleFlush();
  return result;
}

function initSchema() {
  if (!fs.existsSync(dbPath)) {
    forceFlush();
    console.log('初始化新数据库文件：' + dbPath);
  }
}

initSchema();

export default {
  getTable,
  insertOne,
  findByField,
  filterByField,
  filterWhere,
  updateOne,
  transaction,
  forceFlush,
};
