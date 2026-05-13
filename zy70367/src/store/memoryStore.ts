import { User, ImportBatch, ImportRecord, PrecheckWarning, BatchStatus, RecordStatus, PrecheckWarningType } from '../types';

class MemoryStore {
  private users: Map<string, User> = new Map();
  private batches: Map<string, ImportBatch> = new Map();
  private records: Map<string, ImportRecord> = new Map();
  private userEmailIndex: Map<string, string> = new Map();
  private batchRecordsIndex: Map<string, string[]> = new Map();
  private userSourceBatchIndex: Map<string, string> = new Map();
  private userOriginalRoleIds: Map<string, string[]> = new Map();
  
  private static instance: MemoryStore;
  
  private constructor() {
    this.initializeSeedData();
  }
  
  static getInstance(): MemoryStore {
    if (!MemoryStore.instance) {
      MemoryStore.instance = new MemoryStore();
    }
    return MemoryStore.instance;
  }
  
  private initializeSeedData() {
    const now = Date.now();
    
    const existingUsers: User[] = [
      {
        id: 'u-001',
        email: 'wanggang@company.com',
        name: '王刚',
        departmentId: 'dept-tech',
        roleIds: ['role-manager', 'role-developer'],
        createdAt: now - 86400000 * 30,
        updatedAt: now - 86400000 * 10,
        originalUser: true
      },
      {
        id: 'u-002',
        email: 'liming@company.com',
        name: '李明',
        departmentId: 'dept-hr',
        roleIds: ['role-hr-admin'],
        createdAt: now - 86400000 * 60,
        updatedAt: now - 86400000 * 5,
        originalUser: true
      },
      {
        id: 'u-003',
        email: 'zhangwei@company.com',
        name: '张伟',
        departmentId: 'dept-finance',
        roleIds: ['role-finance'],
        createdAt: now - 86400000 * 120,
        updatedAt: now - 86400000 * 2,
        originalUser: true
      }
    ];
    
    existingUsers.forEach(user => {
      this.users.set(user.id, user);
      this.userEmailIndex.set(user.email.toLowerCase(), user.id);
    });
  }
  
  findUserById(id: string): User | undefined {
    return this.users.get(id);
  }
  
  findUserByEmail(email: string): User | undefined {
    const userId = this.userEmailIndex.get(email.toLowerCase());
    return userId ? this.users.get(userId) : undefined;
  }
  
  getUserByBatchId(batchId: string): User[] {
    return Array.from(this.users.values()).filter(u => u.sourceBatchId === batchId);
  }
  
  getAllUsers(): User[] {
    return Array.from(this.users.values());
  }
  
  createUser(user: User): User {
    this.users.set(user.id, user);
    this.userEmailIndex.set(user.email.toLowerCase(), user.id);
    if (user.sourceBatchId) {
      this.userSourceBatchIndex.set(user.id, user.sourceBatchId);
    }
    return user;
  }
  
  updateUser(user: User): User {
    this.users.set(user.id, user);
    return user;
  }
  
  deleteUser(id: string): boolean {
    const user = this.users.get(id);
    if (user) {
      this.users.delete(id);
      this.userEmailIndex.delete(user.email.toLowerCase());
      this.userSourceBatchIndex.delete(id);
      this.userOriginalRoleIds.delete(id);
      return true;
    }
    return false;
  }
  
  getUserSourceBatch(userId: string): string | undefined {
    return this.userSourceBatchIndex.get(userId);
  }
  
  setUserOriginalRoleIds(userId: string, roleIds: string[]): void {
    this.userOriginalRoleIds.set(userId, roleIds);
  }
  
  getUserOriginalRoleIds(userId: string): string[] | undefined {
    return this.userOriginalRoleIds.get(userId);
  }
  
  createBatch(batch: ImportBatch): ImportBatch {
    this.batches.set(batch.id, batch);
    this.batchRecordsIndex.set(batch.id, []);
    return batch;
  }
  
  updateBatch(batch: ImportBatch): ImportBatch {
    this.batches.set(batch.id, batch);
    return batch;
  }
  
  findBatchById(id: string): ImportBatch | undefined {
    return this.batches.get(id);
  }
  
  getAllBatches(): ImportBatch[] {
    return Array.from(this.batches.values());
  }
  
  createRecord(record: ImportRecord): ImportRecord {
    this.records.set(record.id, record);
    const batchRecords = this.batchRecordsIndex.get(record.batchId) || [];
    batchRecords.push(record.id);
    this.batchRecordsIndex.set(record.batchId, batchRecords);
    return record;
  }
  
  updateRecord(record: ImportRecord): ImportRecord {
    this.records.set(record.id, record);
    return record;
  }
  
  findRecordById(id: string): ImportRecord | undefined {
    return this.records.get(id);
  }
  
  getRecordsByBatchId(batchId: string): ImportRecord[] {
    const recordIds = this.batchRecordsIndex.get(batchId) || [];
    return recordIds.map(id => this.records.get(id)).filter(Boolean) as ImportRecord[];
  }
  
  findRecordByBatchAndEmail(batchId: string, email: string): ImportRecord | undefined {
    return this.getRecordsByBatchId(batchId).find(r => r.email.toLowerCase() === email.toLowerCase());
  }
  
  getBatchStats(batchId: string) {
    const records = this.getRecordsByBatchId(batchId);
    return {
      total: records.length,
      created: records.filter(r => r.status === RecordStatus.CREATED).length,
      updated: records.filter(r => r.status === RecordStatus.UPDATED).length,
      skipped: records.filter(r => r.status === RecordStatus.SKIPPED).length,
      failed: records.filter(r => r.status === RecordStatus.FAILED).length,
      revoked: records.filter(r => r.status === RecordStatus.REVOKED).length,
      notRevocable: records.filter(r => r.status === RecordStatus.NOT_REVOCABLE).length,
      revokeFailed: records.filter(r => r.status === RecordStatus.REVOKE_FAILED).length
    };
  }
}

export const store = MemoryStore.getInstance();
