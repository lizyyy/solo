import { v4 as uuidv4 } from 'uuid';
import { TicketBatch, VerificationRecord, Team, VerificationPoint, VerificationStatus } from './types';

export class DataStore {
  private ticketBatches: Map<string, TicketBatch> = new Map();
  private verificationRecords: Map<string, VerificationRecord> = new Map();
  private teams: Map<string, Team> = new Map();
  private verificationPoints: Map<string, VerificationPoint> = new Map();
  private batchLocks: Map<string, boolean> = new Map();
  private recordSequence: number = 0;

  constructor() {
    this.initializeTestData();
  }

  async acquireLock(batchId: string): Promise<boolean> {
    if (this.batchLocks.get(batchId)) {
      return false;
    }
    this.batchLocks.set(batchId, true);
    return true;
  }

  releaseLock(batchId: string): void {
    this.batchLocks.delete(batchId);
  }

  getTicketBatch(id: string): TicketBatch | undefined {
    return this.ticketBatches.get(id);
  }

  getAllTicketBatches(): TicketBatch[] {
    return Array.from(this.ticketBatches.values());
  }

  updateTicketBatch(batch: TicketBatch): void {
    this.ticketBatches.set(batch.id, batch);
  }

  createTicketBatch(batch: Omit<TicketBatch, 'id' | 'createdAt' | 'updatedAt' | 'version'>): TicketBatch {
    const newBatch: TicketBatch = {
      ...batch,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1
    };
    this.ticketBatches.set(newBatch.id, newBatch);
    return newBatch;
  }

  getVerificationRecord(id: string): VerificationRecord | undefined {
    return this.verificationRecords.get(id);
  }

  getVerificationRecordsByBatchId(batchId: string): VerificationRecord[] {
    return Array.from(this.verificationRecords.values())
      .filter(r => r.batchId === batchId)
      .sort((a, b) => b.sequence - a.sequence);
  }

  getAllVerificationRecords(): VerificationRecord[] {
    return Array.from(this.verificationRecords.values())
      .sort((a, b) => b.sequence - a.sequence);
  }

  createVerificationRecord(record: Omit<VerificationRecord, 'id' | 'sequence' | 'createdAt'>): VerificationRecord {
    this.recordSequence++;
    const newRecord: VerificationRecord = {
      ...record,
      id: uuidv4(),
      sequence: this.recordSequence,
      createdAt: new Date()
    };
    this.verificationRecords.set(newRecord.id, newRecord);
    return newRecord;
  }

  getTeam(id: string): Team | undefined {
    return this.teams.get(id);
  }

  getAllTeams(): Team[] {
    return Array.from(this.teams.values());
  }

  getVerificationPoint(id: string): VerificationPoint | undefined {
    return this.verificationPoints.get(id);
  }

  getAllVerificationPoints(): VerificationPoint[] {
    return Array.from(this.verificationPoints.values());
  }

  reset(): void {
    this.ticketBatches.clear();
    this.verificationRecords.clear();
    this.teams.clear();
    this.verificationPoints.clear();
    this.batchLocks.clear();
    this.recordSequence = 0;
    this.initializeTestData();
  }

  private initializeTestData(): void {
    const team1: Team = {
      id: 'team-1',
      name: '阳光旅行团',
      contactPerson: '张三',
      contactPhone: '13800138001',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.teams.set(team1.id, team1);

    const team2: Team = {
      id: 'team-2',
      name: '星空旅游团',
      contactPerson: '李四',
      contactPhone: '13800138002',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.teams.set(team2.id, team2);

    const point1: VerificationPoint = {
      id: 'point-1',
      name: '东门核销点',
      address: '景区东门入口',
      operatorId: 'op001',
      operatorName: '王核销员',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.verificationPoints.set(point1.id, point1);

    const point2: VerificationPoint = {
      id: 'point-2',
      name: '西门核销点',
      address: '景区西门入口',
      operatorId: 'op002',
      operatorName: '李核销员',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.verificationPoints.set(point2.id, point2);

    const batch1: TicketBatch = {
      id: 'batch-1',
      batchNo: 'BATCH-2024-001',
      teamId: team1.id,
      teamName: team1.name,
      totalQuantity: 50,
      remainingQuantity: 50,
      verifiedQuantity: 0,
      status: VerificationStatus.PENDING,
      validFrom: new Date('2024-01-01'),
      validTo: new Date('2030-12-31'),
      remark: '测试批次-完整流转',
      createdBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1
    };
    this.ticketBatches.set(batch1.id, batch1);

    const batch2: TicketBatch = {
      id: 'batch-2',
      batchNo: 'BATCH-2024-002',
      teamId: team2.id,
      teamName: team2.name,
      totalQuantity: 30,
      remainingQuantity: 20,
      verifiedQuantity: 10,
      status: VerificationStatus.PARTIAL,
      validFrom: new Date('2024-01-01'),
      validTo: new Date('2030-12-31'),
      remark: '测试批次-冲突记录',
      createdBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1
    };
    this.ticketBatches.set(batch2.id, batch2);
  }
}

export const store = new DataStore();
