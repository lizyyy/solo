import { v4 as uuidv4 } from 'uuid';
import { CompensationRecord, HistoryRecord, CompensationStatus, HistoryAction, CreateCompensationRequest, PaginatedResult, QueryParams } from '../types';

class DataStore {
  private compensations: Map<string, CompensationRecord> = new Map();
  private histories: Map<string, HistoryRecord> = new Map();

  createCompensation(request: CreateCompensationRequest): CompensationRecord {
    const now = new Date().toISOString();
    const compensation: CompensationRecord = {
      id: uuidv4(),
      ...request,
      status: CompensationStatus.APPLYING,
      isConsumed: false,
      appliedAt: now,
      createdAt: now,
      updatedAt: now
    };
    this.compensations.set(compensation.id, compensation);

    this.addHistory({
      compensationId: compensation.id,
      action: HistoryAction.CREATED,
      operatorId: request.applicantId,
      operatorName: request.applicantName,
      comment: '创建补偿申请',
      afterSnapshot: { ...compensation }
    });

    return compensation;
  }

  getCompensation(id: string): CompensationRecord | undefined {
    return this.compensations.get(id);
  }

  updateCompensation(id: string, updates: Partial<CompensationRecord>): CompensationRecord | undefined {
    const compensation = this.compensations.get(id);
    if (!compensation) return undefined;

    const beforeSnapshot = { ...compensation };
    const updated = { ...compensation, ...updates, updatedAt: new Date().toISOString() };
    this.compensations.set(id, updated);

    return updated;
  }

  deleteCompensation(id: string): boolean {
    return this.compensations.delete(id);
  }

  listCompensations(params: QueryParams): PaginatedResult<CompensationRecord> {
    let results = Array.from(this.compensations.values());

    if (params.memberId) {
      results = results.filter(c => c.memberId === params.memberId);
    }
    if (params.memberName) {
      results = results.filter(c => c.memberName.includes(params.memberName!));
    }
    if (params.memberPhone) {
      results = results.filter(c => c.memberPhone.includes(params.memberPhone!));
    }
    if (params.status) {
      results = results.filter(c => c.status === params.status);
    }
    if (params.expiryBatchId) {
      results = results.filter(c => c.expiryBatchId === params.expiryBatchId);
    }

    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = results.length;
    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    return {
      data: results.slice(start, end),
      total,
      page,
      pageSize
    };
  }

  findByMemberAndBatch(memberId: string, expiryBatchId: string): CompensationRecord[] {
    return Array.from(this.compensations.values()).filter(
      c => c.memberId === memberId && c.expiryBatchId === expiryBatchId
    );
  }

  addHistory(history: Omit<HistoryRecord, 'id' | 'createdAt'>): HistoryRecord {
    const record: HistoryRecord = {
      id: uuidv4(),
      ...history,
      createdAt: new Date().toISOString()
    };
    this.histories.set(record.id, record);
    return record;
  }

  getHistories(compensationId: string): HistoryRecord[] {
    return Array.from(this.histories.values())
      .filter(h => h.compensationId === compensationId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  clear(): void {
    this.compensations.clear();
    this.histories.clear();
  }
}

export const store = new DataStore();
