import * as fs from 'fs';
import * as path from 'path';
import { RepairRecord } from '../types/repair';

export class VersionConflictError extends Error {
  constructor(
    public readonly repairId: string,
    public readonly expectedVersion: number,
    public readonly actualVersion: number
  ) {
    super(`版本冲突: 报修记录 ${repairId} 已被修改`);
    this.name = 'VersionConflictError';
  }
}

export class RepairNotFoundError extends Error {
  constructor(public readonly repairId: string) {
    super(`报修记录不存在: ${repairId}`);
    this.name = 'RepairNotFoundError';
  }
}

export class RepairRepository {
  private readonly dataDir: string;
  private readonly dataFile: string;
  private inMemoryData: Map<string, RepairRecord> = new Map();
  private nextRepairNumber = 1;

  constructor(dataDir?: string) {
    this.dataDir = dataDir || path.join(process.cwd(), 'data');
    this.dataFile = path.join(this.dataDir, 'repairs.json');
    this.ensureDataDirectory();
    this.loadFromDisk();
  }

  private ensureDataDirectory(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.dataFile)) {
        const rawData = fs.readFileSync(this.dataFile, 'utf-8');
        const records = JSON.parse(rawData) as RepairRecord[];
        
        this.inMemoryData.clear();
        records.forEach(record => {
          this.inMemoryData.set(record.id, {
            ...record,
            createdAt: new Date(record.createdAt),
            updatedAt: new Date(record.updatedAt),
            submittedAt: new Date(record.submittedAt),
            completedAt: record.completedAt ? new Date(record.completedAt) : undefined,
            assignment: record.assignment ? {
              ...record.assignment,
              assignedAt: new Date(record.assignment.assignedAt),
              estimatedCompletion: record.assignment.estimatedCompletion 
                ? new Date(record.assignment.estimatedCompletion) 
                : undefined
            } : undefined,
            mergeHistory: record.mergeHistory.map(m => ({
              ...m,
              mergedAt: new Date(m.mergedAt)
            }))
          });
        });

        if (records.length > 0) {
          const maxNumber = Math.max(...records.map(r => parseInt(r.repairNumber.replace('REP-', ''), 10)));
          this.nextRepairNumber = maxNumber + 1;
        }
      }
    } catch (error) {
      console.error('加载数据失败，使用空数据集:', error);
      this.inMemoryData.clear();
    }
  }

  private persistToDisk(): void {
    try {
      const records = Array.from(this.inMemoryData.values());
      fs.writeFileSync(this.dataFile, JSON.stringify(records, null, 2), 'utf-8');
    } catch (error) {
      console.error('持久化数据失败:', error);
      throw new Error('数据持久化失败');
    }
  }

  generateRepairNumber(): string {
    return `REP-${String(this.nextRepairNumber++).padStart(6, '0')}`;
  }

  async create(record: RepairRecord): Promise<RepairRecord> {
    if (this.inMemoryData.has(record.id)) {
      throw new Error(`报修记录已存在: ${record.id}`);
    }
    
    this.inMemoryData.set(record.id, record);
    this.persistToDisk();
    return record;
  }

  async findById(id: string): Promise<RepairRecord | undefined> {
    return this.inMemoryData.get(id);
  }

  async findByRepairNumber(repairNumber: string): Promise<RepairRecord | undefined> {
    for (const record of this.inMemoryData.values()) {
      if (record.repairNumber === repairNumber) {
        return record;
      }
    }
    return undefined;
  }

  async findAll(): Promise<RepairRecord[]> {
    return Array.from(this.inMemoryData.values());
  }

  async findDuplicates(locationBuilding: string, locationFloor: string, category: string, titleKeywords: string[]): Promise<RepairRecord[]> {
    const duplicates: RepairRecord[] = [];
    
    for (const record of this.inMemoryData.values()) {
      if (record.isDuplicate || record.mergedInto) continue;
      if (record.status === 'completed' || record.status === 'verified' || record.status === 'cancelled') continue;
      
      const locationMatch = record.location.building === locationBuilding && 
                           record.location.floor === locationFloor;
      const categoryMatch = record.category === category;
      const titleMatch = titleKeywords.some(keyword => 
        record.title.toLowerCase().includes(keyword.toLowerCase())
      );
      
      if (locationMatch && categoryMatch && titleMatch) {
        duplicates.push(record);
      }
    }
    
    return duplicates;
  }

  async update(
    id: string,
    expectedVersion: number,
    updateFn: (record: RepairRecord) => RepairRecord
  ): Promise<RepairRecord> {
    const existing = this.inMemoryData.get(id);
    
    if (!existing) {
      throw new RepairNotFoundError(id);
    }
    
    if (existing.version !== expectedVersion) {
      throw new VersionConflictError(id, expectedVersion, existing.version);
    }
    
    const updated = updateFn(existing);
    updated.version = existing.version + 1;
    updated.updatedAt = new Date();
    
    this.inMemoryData.set(id, updated);
    this.persistToDisk();
    
    return updated;
  }

  async batchUpdate(records: { id: string; expectedVersion: number; updateFn: (record: RepairRecord) => RepairRecord }[]): Promise<RepairRecord[]> {
    for (const { id, expectedVersion } of records) {
      const existing = this.inMemoryData.get(id);
      if (!existing) {
        throw new RepairNotFoundError(id);
      }
      if (existing.version !== expectedVersion) {
        throw new VersionConflictError(id, expectedVersion, existing.version);
      }
    }

    const results: RepairRecord[] = [];
    
    for (const { id, updateFn } of records) {
      const existing = this.inMemoryData.get(id)!;
      const updated = updateFn(existing);
      updated.version = existing.version + 1;
      updated.updatedAt = new Date();
      this.inMemoryData.set(id, updated);
      results.push(updated);
    }
    
    this.persistToDisk();
    return results;
  }

  async delete(id: string): Promise<void> {
    if (!this.inMemoryData.has(id)) {
      throw new RepairNotFoundError(id);
    }
    this.inMemoryData.delete(id);
    this.persistToDisk();
  }

  async clearAll(): Promise<void> {
    this.inMemoryData.clear();
    this.nextRepairNumber = 1;
    this.persistToDisk();
  }

  async bulkImport(records: RepairRecord[]): Promise<{ success: string[]; failed: { record: RepairRecord; error: string }[] }> {
    const success: string[] = [];
    const failed: { record: RepairRecord; error: string }[] = [];
    
    for (const record of records) {
      try {
        if (this.inMemoryData.has(record.id)) {
          failed.push({ record, error: `记录ID已存在: ${record.id}` });
          continue;
        }
        
        const existingByNumber = await this.findByRepairNumber(record.repairNumber);
        if (existingByNumber) {
          failed.push({ record, error: `报修编号已存在: ${record.repairNumber}` });
          continue;
        }
        
        this.inMemoryData.set(record.id, record);
        success.push(record.id);
        
        const recordNum = parseInt(record.repairNumber.replace('REP-', ''), 10);
        if (recordNum >= this.nextRepairNumber) {
          this.nextRepairNumber = recordNum + 1;
        }
      } catch (error) {
        failed.push({ record, error: error instanceof Error ? error.message : '未知错误' });
      }
    }
    
    this.persistToDisk();
    return { success, failed };
  }
}

export const repairRepository = new RepairRepository();
