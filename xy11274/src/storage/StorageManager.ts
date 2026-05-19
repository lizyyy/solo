import { JsonStorage } from './JsonStorage';
import { Forklift } from '../models/Forklift';
import { ChargingPile } from '../models/ChargingPile';
import { Shift } from '../models/Shift';
import { Schedule } from '../models/Schedule';
import { LockRecord } from '../models/LockRecord';
import { AuditLog } from '../models/AuditLog';

export class StorageManager {
  private static instance: StorageManager;
  
  public forklifts: JsonStorage<Forklift>;
  public chargingPiles: JsonStorage<ChargingPile>;
  public shifts: JsonStorage<Shift>;
  public schedules: JsonStorage<Schedule>;
  public lockRecords: JsonStorage<LockRecord>;
  public auditLogs: JsonStorage<AuditLog>;

  private constructor() {
    this.forklifts = new JsonStorage<Forklift>('forklifts');
    this.chargingPiles = new JsonStorage<ChargingPile>('chargingPiles');
    this.shifts = new JsonStorage<Shift>('shifts');
    this.schedules = new JsonStorage<Schedule>('schedules');
    this.lockRecords = new JsonStorage<LockRecord>('lockRecords');
    this.auditLogs = new JsonStorage<AuditLog>('auditLogs');
  }

  public static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager();
    }
    return StorageManager.instance;
  }

  public clearAll(): void {
    this.forklifts.clear();
    this.chargingPiles.clear();
    this.shifts.clear();
    this.schedules.clear();
    this.lockRecords.clear();
    this.auditLogs.clear();
  }
}

export const storage = StorageManager.getInstance();
