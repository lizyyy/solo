import * as path from 'path';
import { JsonStorage } from './JsonStorage';
import {
  Visitor,
  Appointment,
  TemporaryPlate,
  BlacklistEntry,
  VerificationRecord,
  AuditLog
} from '../models/types';

const DATA_DIR = path.join(process.cwd(), 'data');

export class StorageManager {
  private static instance: StorageManager;

  public readonly visitors: JsonStorage<Visitor>;
  public readonly appointments: JsonStorage<Appointment>;
  public readonly temporaryPlates: JsonStorage<TemporaryPlate>;
  public readonly blacklist: JsonStorage<BlacklistEntry>;
  public readonly verificationRecords: JsonStorage<VerificationRecord>;
  public readonly auditLogs: JsonStorage<AuditLog>;

  private constructor() {
    this.visitors = new JsonStorage<Visitor>(DATA_DIR, 'visitors');
    this.appointments = new JsonStorage<Appointment>(DATA_DIR, 'appointments');
    this.temporaryPlates = new JsonStorage<TemporaryPlate>(DATA_DIR, 'temporaryPlates');
    this.blacklist = new JsonStorage<BlacklistEntry>(DATA_DIR, 'blacklist');
    this.verificationRecords = new JsonStorage<VerificationRecord>(DATA_DIR, 'verificationRecords');
    this.auditLogs = new JsonStorage<AuditLog>(DATA_DIR, 'auditLogs');
  }

  public static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager();
    }
    return StorageManager.instance;
  }
}

export const storage = StorageManager.getInstance();
