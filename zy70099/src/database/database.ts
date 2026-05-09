import * as sqlite3 from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';
import {
  Battery,
  CabinetSlot,
  Transaction,
  ExceptionRecord,
  PendingTask,
  BatteryStatus,
  SlotStatus,
  TransactionType,
  TransactionStatus,
  ExceptionType,
} from '../types';

const DB_PATH = process.env.DB_PATH || './data/battery-cabinet.db';

export class Database {
  private db: sqlite3.Database;

  constructor() {
    this.db = new sqlite3.Database(DB_PATH);
    this.initTables();
  }

  private initTables(): void {
    this.db.serialize(() => {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS batteries (
          id TEXT PRIMARY KEY,
          battery_code TEXT UNIQUE NOT NULL,
          status TEXT NOT NULL,
          cycle_count INTEGER NOT NULL DEFAULT 0,
          max_cycle_count INTEGER NOT NULL DEFAULT 1000,
          current_slot_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS cabinet_slots (
          id TEXT PRIMARY KEY,
          cabinet_id TEXT NOT NULL,
          slot_number INTEGER NOT NULL,
          status TEXT NOT NULL,
          battery_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(cabinet_id, slot_number)
        )
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS transactions (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          battery_code TEXT NOT NULL,
          user_id TEXT NOT NULL,
          cabinet_id TEXT NOT NULL,
          slot_number INTEGER NOT NULL,
          status TEXT NOT NULL,
          created_at TEXT NOT NULL,
          completed_at TEXT
        )
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS exception_records (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          related_transaction_id TEXT,
          battery_code TEXT,
          slot_id TEXT,
          details TEXT NOT NULL,
          message TEXT NOT NULL,
          is_resolved INTEGER NOT NULL DEFAULT 0,
          resolved_by TEXT,
          resolved_at TEXT,
          created_at TEXT NOT NULL
        )
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS pending_tasks (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          related_entity_id TEXT NOT NULL,
          related_entity_type TEXT NOT NULL,
          priority TEXT NOT NULL,
          details TEXT NOT NULL,
          is_handled INTEGER NOT NULL DEFAULT 0,
          handled_by TEXT,
          handled_at TEXT,
          created_at TEXT NOT NULL
        )
      `);

      this.db.run(`
        CREATE INDEX IF NOT EXISTS idx_batteries_code ON batteries(battery_code)
      `);
      this.db.run(`
        CREATE INDEX IF NOT EXISTS idx_slots_cabinet ON cabinet_slots(cabinet_id, slot_number)
      `);
      this.db.run(`
        CREATE INDEX IF NOT EXISTS idx_transactions_battery ON transactions(battery_code)
      `);
      this.db.run(`
        CREATE INDEX IF NOT EXISTS idx_exceptions_unresolved ON exception_records(is_resolved)
      `);
      this.db.run(`
        CREATE INDEX IF NOT EXISTS idx_tasks_pending ON pending_tasks(is_handled)
      `);
    });
  }

  private now(): string {
    return new Date().toISOString();
  }

  createBattery(batteryCode: string, maxCycleCount: number = 1000): Promise<Battery> {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const now = this.now();
      this.db.run(
        `INSERT INTO batteries (id, battery_code, status, cycle_count, max_cycle_count, current_slot_id, created_at, updated_at)
         VALUES (?, ?, ?, 0, ?, NULL, ?, ?)`,
        [id, batteryCode, BatteryStatus.CHARGING, maxCycleCount, now, now],
        (err) => {
          if (err) reject(err);
          else resolve({
            id,
            batteryCode,
            status: BatteryStatus.CHARGING,
            cycleCount: 0,
            maxCycleCount,
            currentSlotId: null,
            createdAt: now,
            updatedAt: now,
          });
        }
      );
    });
  }

  getBatteryByCode(batteryCode: string): Promise<Battery | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT id, battery_code as batteryCode, status, cycle_count as cycleCount,
                max_cycle_count as maxCycleCount, current_slot_id as currentSlotId,
                created_at as createdAt, updated_at as updatedAt
         FROM batteries WHERE battery_code = ?`,
        [batteryCode],
        (err, row: any) => {
          if (err) reject(err);
          else resolve(row || null);
        }
      );
    });
  }

  updateBattery(battery: Battery): Promise<Battery> {
    return new Promise((resolve, reject) => {
      const now = this.now();
      this.db.run(
        `UPDATE batteries SET status = ?, cycle_count = ?, max_cycle_count = ?,
         current_slot_id = ?, updated_at = ? WHERE id = ?`,
        [battery.status, battery.cycleCount, battery.maxCycleCount, battery.currentSlotId, now, battery.id],
        (err) => {
          if (err) reject(err);
          else resolve({ ...battery, updatedAt: now });
        }
      );
    });
  }

  createCabinetSlot(cabinetId: string, slotNumber: number): Promise<CabinetSlot> {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const now = this.now();
      this.db.run(
        `INSERT INTO cabinet_slots (id, cabinet_id, slot_number, status, battery_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, NULL, ?, ?)`,
        [id, cabinetId, slotNumber, SlotStatus.EMPTY, now, now],
        (err) => {
          if (err) reject(err);
          else resolve({
            id,
            cabinetId,
            slotNumber,
            status: SlotStatus.EMPTY,
            batteryId: null,
            createdAt: now,
            updatedAt: now,
          });
        }
      );
    });
  }

  getSlot(cabinetId: string, slotNumber: number): Promise<CabinetSlot | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT id, cabinet_id as cabinetId, slot_number as slotNumber, status,
                battery_id as batteryId, created_at as createdAt, updated_at as updatedAt
         FROM cabinet_slots WHERE cabinet_id = ? AND slot_number = ?`,
        [cabinetId, slotNumber],
        (err, row: any) => {
          if (err) reject(err);
          else resolve(row || null);
        }
      );
    });
  }

  getSlotById(id: string): Promise<CabinetSlot | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT id, cabinet_id as cabinetId, slot_number as slotNumber, status,
                battery_id as batteryId, created_at as createdAt, updated_at as updatedAt
         FROM cabinet_slots WHERE id = ?`,
        [id],
        (err, row: any) => {
          if (err) reject(err);
          else resolve(row || null);
        }
      );
    });
  }

  updateSlot(slot: CabinetSlot): Promise<CabinetSlot> {
    return new Promise((resolve, reject) => {
      const now = this.now();
      this.db.run(
        `UPDATE cabinet_slots SET status = ?, battery_id = ?, updated_at = ? WHERE id = ?`,
        [slot.status, slot.batteryId, now, slot.id],
        (err) => {
          if (err) reject(err);
          else resolve({ ...slot, updatedAt: now });
        }
      );
    });
  }

  createTransaction(
    type: TransactionType,
    batteryCode: string,
    userId: string,
    cabinetId: string,
    slotNumber: number,
    status: TransactionStatus = TransactionStatus.PENDING_REVIEW
  ): Promise<Transaction> {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const now = this.now();
      this.db.run(
        `INSERT INTO transactions (id, type, battery_code, user_id, cabinet_id, slot_number, status, created_at, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        [id, type, batteryCode, userId, cabinetId, slotNumber, status, now],
        (err) => {
          if (err) reject(err);
          else resolve({
            id,
            type,
            batteryCode,
            userId,
            cabinetId,
            slotNumber,
            status,
            createdAt: now,
            completedAt: null,
          });
        }
      );
    });
  }

  updateTransaction(transaction: Transaction): Promise<Transaction> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE transactions SET status = ?, completed_at = ? WHERE id = ?`,
        [transaction.status, transaction.completedAt, transaction.id],
        (err) => {
          if (err) reject(err);
          else resolve(transaction);
        }
      );
    });
  }

  getTransactionById(id: string): Promise<Transaction | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT id, type, battery_code as batteryCode, user_id as userId,
                cabinet_id as cabinetId, slot_number as slotNumber, status,
                created_at as createdAt, completed_at as completedAt
         FROM transactions WHERE id = ?`,
        [id],
        (err, row: any) => {
          if (err) reject(err);
          else resolve(row || null);
        }
      );
    });
  }

  createExceptionRecord(
    type: ExceptionType,
    message: string,
    details: Record<string, any>,
    relatedTransactionId: string | null = null,
    batteryCode: string | null = null,
    slotId: string | null = null
  ): Promise<ExceptionRecord> {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const now = this.now();
      this.db.run(
        `INSERT INTO exception_records
         (id, type, related_transaction_id, battery_code, slot_id, details, message, is_resolved, resolved_by, resolved_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, ?)`,
        [id, type, relatedTransactionId, batteryCode, slotId, JSON.stringify(details), message, now],
        (err) => {
          if (err) reject(err);
          else resolve({
            id,
            type,
            relatedTransactionId,
            batteryCode,
            slotId,
            details,
            message,
            isResolved: false,
            resolvedBy: null,
            resolvedAt: null,
            createdAt: now,
          });
        }
      );
    });
  }

  getUnresolvedExceptions(): Promise<ExceptionRecord[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT id, type, related_transaction_id as relatedTransactionId, battery_code as batteryCode,
                slot_id as slotId, details, message, is_resolved as isResolved,
                resolved_by as resolvedBy, resolved_at as resolvedAt, created_at as createdAt
         FROM exception_records WHERE is_resolved = 0 ORDER BY created_at DESC`,
        [],
        (err, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows.map((r) => ({ ...r, details: JSON.parse(r.details), isResolved: !!r.isResolved })));
        }
      );
    });
  }

  createPendingTask(
    type: 'MANUAL_REVIEW' | 'BATTERY_INSPECTION' | 'SLOT_CLEANUP',
    relatedEntityId: string,
    relatedEntityType: 'BATTERY' | 'SLOT' | 'TRANSACTION',
    priority: 'HIGH' | 'MEDIUM' | 'LOW',
    details: Record<string, any>
  ): Promise<PendingTask> {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const now = this.now();
      this.db.run(
        `INSERT INTO pending_tasks
         (id, type, related_entity_id, related_entity_type, priority, details, is_handled, handled_by, handled_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, NULL, NULL, ?)`,
        [id, type, relatedEntityId, relatedEntityType, priority, JSON.stringify(details), now],
        (err) => {
          if (err) reject(err);
          else resolve({
            id,
            type,
            relatedEntityId,
            relatedEntityType,
            priority,
            details,
            isHandled: false,
            handledBy: null,
            handledAt: null,
            createdAt: now,
          });
        }
      );
    });
  }

  getPendingTasks(): Promise<PendingTask[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT id, type, related_entity_id as relatedEntityId, related_entity_type as relatedEntityType,
                priority, details, is_handled as isHandled, handled_by as handledBy,
                handled_at as handledAt, created_at as createdAt
         FROM pending_tasks WHERE is_handled = 0 ORDER BY
           CASE priority WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
           created_at ASC`,
        [],
        (err, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows.map((r) => ({ ...r, details: JSON.parse(r.details), isHandled: !!r.isHandled })));
        }
      );
    });
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

export const db = new Database();
