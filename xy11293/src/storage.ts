import * as fs from 'fs';
import * as path from 'path';
import dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';
import { Database, Equipment, Booth, RentalRecord, AuditLog, InventorySnapshot } from './types';
import { DATA_DIR, DB_FILE, DB_VERSION, BACKUP_RETENTION_DAYS } from './config';

export class Storage {
  private db: Database | null = null;
  private writeLock: boolean = false;

  constructor() {
    this.init();
  }

  private init(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(DB_FILE)) {
      this.initializeDatabase();
    } else {
      this.loadDatabase();
    }
  }

  private initializeDatabase(): void {
    const now = dayjs().toISOString();
    this.db = {
      version: DB_VERSION,
      lastModified: now,
      equipment: [],
      booths: [],
      rentalRecords: [],
      auditLogs: [],
      snapshots: [],
      requestIds: []
    };
    this.persist();
  }

  private loadDatabase(): void {
    try {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      this.db = JSON.parse(data);
      this.migrateDatabase();
    } catch (error) {
      console.error('加载数据库失败，尝试从备份恢复...', error);
      this.tryRestoreFromBackup();
    }
  }

  private migrateDatabase(): void {
    if (!this.db) return;
    
    if (this.db.version !== DB_VERSION) {
      console.log(`数据库版本升级: ${this.db.version} -> ${DB_VERSION}`);
      this.db.version = DB_VERSION;
    }

    if (!this.db.requestIds) {
      this.db.requestIds = [];
    }
    if (!this.db.snapshots) {
      this.db.snapshots = [];
    }
  }

  private tryRestoreFromBackup(): void {
    const backupDir = path.join(DATA_DIR, 'backups');
    if (fs.existsSync(backupDir)) {
      const backups = fs.readdirSync(backupDir)
        .filter(f => f.endsWith('.json'))
        .sort()
        .reverse();

      for (const backup of backups) {
        try {
          const backupPath = path.join(backupDir, backup);
          const data = fs.readFileSync(backupPath, 'utf-8');
          this.db = JSON.parse(data);
          console.log(`已从备份恢复: ${backup}`);
          return;
        } catch {
          continue;
        }
      }
    }

    console.log('无有效备份，创建新数据库');
    this.initializeDatabase();
  }

  private createBackup(): void {
    const backupDir = path.join(DATA_DIR, 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = dayjs().format('YYYYMMDD-HHmmss');
    const backupFile = path.join(backupDir, `backup-${timestamp}.json`);
    
    if (this.db) {
      fs.writeFileSync(backupFile, JSON.stringify(this.db, null, 2));
    }

    this.cleanupOldBackups(backupDir);
  }

  private cleanupOldBackups(backupDir: string): void {
    const cutoff = dayjs().subtract(BACKUP_RETENTION_DAYS, 'day');
    const backups = fs.readdirSync(backupDir);

    for (const backup of backups) {
      const match = backup.match(/backup-(\d{8})-(\d{6})\.json/);
      if (match) {
        const dateStr = match[1];
        const backupDate = dayjs(dateStr, 'YYYYMMDD');
        if (backupDate.isBefore(cutoff)) {
          fs.unlinkSync(path.join(backupDir, backup));
        }
      }
    }
  }

  public persist(): void {
    if (!this.db || this.writeLock) return;

    this.writeLock = true;
    try {
      this.db.lastModified = dayjs().toISOString();
      this.createBackup();
      const tempFile = `${DB_FILE}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(this.db, null, 2));
      fs.renameSync(tempFile, DB_FILE);
    } finally {
      this.writeLock = false;
    }
  }

  public getEquipment(): Equipment[] {
    return this.db?.equipment || [];
  }

  public getEquipmentById(id: string): Equipment | undefined {
    return this.db?.equipment.find(e => e.id === id);
  }

  public addEquipment(equipment: Omit<Equipment, 'id' | 'lastUpdated'>): Equipment {
    const newEquipment: Equipment = {
      ...equipment,
      id: uuidv4(),
      lastUpdated: dayjs().toISOString()
    };
    this.db?.equipment.push(newEquipment);
    this.persist();
    return newEquipment;
  }

  public updateEquipment(id: string, updates: Partial<Equipment>): Equipment | undefined {
    const index = this.db?.equipment.findIndex(e => e.id === id);
    if (index !== undefined && index >= 0 && this.db) {
      this.db.equipment[index] = {
        ...this.db.equipment[index],
        ...updates,
        lastUpdated: dayjs().toISOString()
      };
      this.persist();
      return this.db.equipment[index];
    }
    return undefined;
  }

  public getBooths(): Booth[] {
    return this.db?.booths || [];
  }

  public getBoothById(id: string): Booth | undefined {
    return this.db?.booths.find(b => b.id === id);
  }

  public getBoothByNumber(boothNumber: string): Booth | undefined {
    return this.db?.booths.find(b => b.boothNumber === boothNumber);
  }

  public addBooth(booth: Omit<Booth, 'id' | 'createdAt'>): Booth {
    const newBooth: Booth = {
      ...booth,
      id: uuidv4(),
      createdAt: dayjs().toISOString()
    };
    this.db?.booths.push(newBooth);
    this.persist();
    return newBooth;
  }

  public getRentalRecords(): RentalRecord[] {
    return this.db?.rentalRecords || [];
  }

  public getRentalRecordById(id: string): RentalRecord | undefined {
    return this.db?.rentalRecords.find(r => r.id === id);
  }

  public getRentalRecordByRequestId(requestId: string): RentalRecord | undefined {
    return this.db?.rentalRecords.find(r => r.requestId === requestId);
  }

  public getRentalRecordsByBoothId(boothId: string): RentalRecord[] {
    return this.db?.rentalRecords.filter(r => r.boothId === boothId) || [];
  }

  public addRentalRecord(record: Omit<RentalRecord, 'id' | 'createdAt' | 'updatedAt'>): RentalRecord {
    const newRecord: RentalRecord = {
      ...record,
      id: uuidv4(),
      createdAt: dayjs().toISOString(),
      updatedAt: dayjs().toISOString()
    };
    this.db?.rentalRecords.push(newRecord);
    this.persist();
    return newRecord;
  }

  public updateRentalRecord(id: string, updates: Partial<RentalRecord>): RentalRecord | undefined {
    const index = this.db?.rentalRecords.findIndex(r => r.id === id);
    if (index !== undefined && index >= 0 && this.db) {
      this.db.rentalRecords[index] = {
        ...this.db.rentalRecords[index],
        ...updates,
        updatedAt: dayjs().toISOString()
      };
      this.persist();
      return this.db.rentalRecords[index];
    }
    return undefined;
  }

  public getAuditLogs(): AuditLog[] {
    return this.db?.auditLogs || [];
  }

  public addAuditLog(log: Omit<AuditLog, 'id' | 'timestamp'>): AuditLog {
    const newLog: AuditLog = {
      ...log,
      id: uuidv4(),
      timestamp: dayjs().toISOString()
    };
    this.db?.auditLogs.push(newLog);
    this.persist();
    return newLog;
  }

  public addRequestId(requestId: string): void {
    if (this.db && !this.db.requestIds.includes(requestId)) {
      this.db.requestIds.push(requestId);
      this.persist();
    }
  }

  public hasRequestId(requestId: string): boolean {
    return this.db?.requestIds.includes(requestId) || false;
  }

  public getSnapshots(): InventorySnapshot[] {
    return this.db?.snapshots || [];
  }

  public createSnapshot(createdBy: string): InventorySnapshot {
    const equipment = this.getEquipment();
    const totalValue = equipment.reduce((sum, e) => {
      return sum + (e.pricePerDay || 0) * e.totalQuantity;
    }, 0);

    const snapshot: InventorySnapshot = {
      id: uuidv4(),
      timestamp: dayjs().toISOString(),
      equipment: JSON.parse(JSON.stringify(equipment)),
      totalValue,
      createdBy
    };

    this.db?.snapshots.push(snapshot);
    this.persist();
    return snapshot;
  }

  public getBoothRentedQuantity(boothId: string, equipmentId: string): number {
    return this.db?.rentalRecords
      .filter(r => 
        r.boothId === boothId && 
        r.status === 'confirmed'
      )
      .reduce((sum, r) => {
        const item = r.items.find(i => i.equipmentId === equipmentId);
        return sum + (item?.quantity || 0);
      }, 0) || 0;
  }

  public exportDatabase(): Database {
    return JSON.parse(JSON.stringify(this.db));
  }
}

export const storage = new Storage();
