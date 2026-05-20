import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  ChildProfile,
  VaccineInventory,
  AppointmentRecord,
  ContraindicationRule,
  Batch,
  OperationLog,
  OperationType,
  RecordStatus
} from '../types';

interface DataStoreSchema {
  childProfiles: ChildProfile[];
  vaccineInventories: VaccineInventory[];
  appointmentRecords: AppointmentRecord[];
  contraindicationRules: ContraindicationRule[];
  batches: Batch[];
}

export class DataStore {
  private dataPath: string;
  private data: DataStoreSchema;

  constructor(dataDir: string = './data') {
    this.dataPath = path.join(process.cwd(), dataDir, 'data.json');
    this.data = this.initializeData();
    this.ensureDataDir(dataDir);
    this.loadData();
  }

  private initializeData(): DataStoreSchema {
    return {
      childProfiles: [],
      vaccineInventories: [],
      appointmentRecords: [],
      contraindicationRules: [],
      batches: []
    };
  }

  private ensureDataDir(dataDir: string): void {
    const dirPath = path.join(process.cwd(), dataDir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  private loadData(): void {
    try {
      if (fs.existsSync(this.dataPath)) {
        const fileContent = fs.readFileSync(this.dataPath, 'utf-8');
        this.data = JSON.parse(fileContent);
      } else {
        this.saveData();
      }
    } catch (error) {
      console.error('加载数据失败，使用空数据:', error);
      this.data = this.initializeData();
    }
  }

  private saveData(): void {
    try {
      fs.writeFileSync(this.dataPath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (error) {
      console.error('保存数据失败:', error);
      throw error;
    }
  }

  createChildProfile(profile: Omit<ChildProfile, 'id' | 'createdAt' | 'updatedAt' | 'healthConditions' | 'vaccineHistory'> & Partial<Pick<ChildProfile, 'healthConditions' | 'vaccineHistory'>>): ChildProfile {
    const now = new Date().toISOString();
    const newProfile: ChildProfile = {
      healthConditions: [],
      vaccineHistory: [],
      ...profile,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now
    };
    this.data.childProfiles.push(newProfile);
    this.saveData();
    return newProfile;
  }

  getChildProfiles(): ChildProfile[] {
    return this.data.childProfiles;
  }

  getChildProfileById(id: string): ChildProfile | undefined {
    return this.data.childProfiles.find(p => p.id === id);
  }

  getChildProfileByIdCard(idCard: string): ChildProfile | undefined {
    return this.data.childProfiles.find(p => p.idCard === idCard);
  }

  updateChildProfile(id: string, updates: Partial<ChildProfile>): ChildProfile | undefined {
    const index = this.data.childProfiles.findIndex(p => p.id === id);
    if (index === -1) return undefined;
    this.data.childProfiles[index] = {
      ...this.data.childProfiles[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.saveData();
    return this.data.childProfiles[index];
  }

  createVaccineInventory(inventory: Omit<VaccineInventory, 'id' | 'createdAt' | 'updatedAt'>): VaccineInventory {
    const now = new Date().toISOString();
    const newInventory: VaccineInventory = {
      ...inventory,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now
    };
    this.data.vaccineInventories.push(newInventory);
    this.saveData();
    return newInventory;
  }

  getVaccineInventories(): VaccineInventory[] {
    return this.data.vaccineInventories;
  }

  getVaccineInventoryByCode(vaccineCode: string): VaccineInventory | undefined {
    return this.data.vaccineInventories.find(v => v.vaccineCode === vaccineCode && v.availableQuantity > 0);
  }

  updateVaccineInventory(id: string, updates: Partial<VaccineInventory>): VaccineInventory | undefined {
    const index = this.data.vaccineInventories.findIndex(v => v.id === id);
    if (index === -1) return undefined;
    this.data.vaccineInventories[index] = {
      ...this.data.vaccineInventories[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.saveData();
    return this.data.vaccineInventories[index];
  }

  createAppointmentRecord(record: Omit<AppointmentRecord, 'id' | 'operationLogs' | 'createdAt' | 'updatedAt'>): AppointmentRecord {
    const now = new Date().toISOString();
    const newRecord: AppointmentRecord = {
      ...record,
      id: uuidv4(),
      operationLogs: [],
      createdAt: now,
      updatedAt: now
    };
    this.data.appointmentRecords.push(newRecord);
    this.saveData();
    return newRecord;
  }

  getAppointmentRecords(): AppointmentRecord[] {
    return this.data.appointmentRecords;
  }

  getAppointmentRecordById(id: string): AppointmentRecord | undefined {
    return this.data.appointmentRecords.find(r => r.id === id);
  }

  getAppointmentRecordsByChildId(childId: string): AppointmentRecord[] {
    return this.data.appointmentRecords.filter(r => r.childId === childId);
  }

  getAppointmentRecordsByBatchId(batchId: string): AppointmentRecord[] {
    return this.data.appointmentRecords.filter(r => r.batchId === batchId);
  }

  updateAppointmentRecord(id: string, updates: Partial<AppointmentRecord>): AppointmentRecord | undefined {
    const index = this.data.appointmentRecords.findIndex(r => r.id === id);
    if (index === -1) return undefined;
    this.data.appointmentRecords[index] = {
      ...this.data.appointmentRecords[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.saveData();
    return this.data.appointmentRecords[index];
  }

  addOperationLog(recordId: string, operation: Omit<OperationLog, 'id' | 'timestamp'>): AppointmentRecord | undefined {
    const record = this.getAppointmentRecordById(recordId);
    if (!record) return undefined;
    
    const log: OperationLog = {
      ...operation,
      id: uuidv4(),
      timestamp: new Date().toISOString()
    };
    record.operationLogs.push(log);
    return this.updateAppointmentRecord(recordId, { operationLogs: record.operationLogs });
  }

  createContraindicationRule(rule: Omit<ContraindicationRule, 'id' | 'createdAt'>): ContraindicationRule {
    const now = new Date().toISOString();
    const newRule: ContraindicationRule = {
      ...rule,
      id: uuidv4(),
      createdAt: now
    };
    this.data.contraindicationRules.push(newRule);
    this.saveData();
    return newRule;
  }

  getContraindicationRules(): ContraindicationRule[] {
    return this.data.contraindicationRules;
  }

  getContraindicationRulesByVaccineCode(vaccineCode: string): ContraindicationRule[] {
    return this.data.contraindicationRules.filter(r => r.vaccineCode === vaccineCode);
  }

  createBatch(batch: Omit<Batch, 'id' | 'createdAt'>): Batch {
    const now = new Date().toISOString();
    const newBatch: Batch = {
      ...batch,
      id: uuidv4(),
      createdAt: now
    };
    this.data.batches.push(newBatch);
    this.saveData();
    return newBatch;
  }

  getBatches(): Batch[] {
    return this.data.batches;
  }

  getBatchById(id: string): Batch | undefined {
    return this.data.batches.find(b => b.id === id);
  }

  updateBatch(id: string, updates: Partial<Batch>): Batch | undefined {
    const index = this.data.batches.findIndex(b => b.id === id);
    if (index === -1) return undefined;
    this.data.batches[index] = {
      ...this.data.batches[index],
      ...updates
    };
    this.saveData();
    return this.data.batches[index];
  }

  getNextWaitlistOrder(batchId: string): number {
    const waitlistedRecords = this.data.appointmentRecords.filter(
      r => r.batchId === batchId && r.status === RecordStatus.WAITLISTED && r.waitlistOrder
    );
    const maxOrder = Math.max(...waitlistedRecords.map(r => r.waitlistOrder || 0), 0);
    return maxOrder + 1;
  }

  bulkInsertChildProfiles(profiles: Array<Omit<ChildProfile, 'id' | 'createdAt' | 'updatedAt' | 'healthConditions' | 'vaccineHistory'> & Partial<Pick<ChildProfile, 'healthConditions' | 'vaccineHistory'>>>): ChildProfile[] {
    const now = new Date().toISOString();
    const newProfiles = profiles.map(p => ({
      healthConditions: [],
      vaccineHistory: [],
      ...p,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now
    }));
    this.data.childProfiles.push(...newProfiles);
    this.saveData();
    return newProfiles;
  }

  bulkInsertVaccineInventories(inventories: Omit<VaccineInventory, 'id' | 'createdAt' | 'updatedAt'>[]): VaccineInventory[] {
    const now = new Date().toISOString();
    const newInventories = inventories.map(i => ({
      ...i,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now
    }));
    this.data.vaccineInventories.push(...newInventories);
    this.saveData();
    return newInventories;
  }

  bulkInsertContraindicationRules(rules: Omit<ContraindicationRule, 'id' | 'createdAt'>[]): ContraindicationRule[] {
    const now = new Date().toISOString();
    const newRules = rules.map(r => ({
      ...r,
      id: uuidv4(),
      createdAt: now
    }));
    this.data.contraindicationRules.push(...newRules);
    this.saveData();
    return newRules;
  }
}

export const dataStore = new DataStore();
