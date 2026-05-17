import { v4 as uuidv4 } from 'uuid';
import { GrayConfigRecycle, RecycleStatus, CreateRecycleRequest, QueryRecycleRequest, QueryRecycleResponse, ExceptionRecord } from '../types';

class RecycleStore {
  private records: Map<string, GrayConfigRecycle> = new Map();

  create(request: CreateRecycleRequest): GrayConfigRecycle {
    const id = uuidv4();
    const now = new Date();
    
    const record: GrayConfigRecycle = {
      id,
      configKey: request.configKey,
      grayScope: request.grayScope,
      owner: request.owner,
      recycleDate: new Date(request.recycleDate),
      hitTenants: request.hitTenants || [],
      status: RecycleStatus.PENDING,
      exceptions: [],
      createdAt: now,
      updatedAt: now,
      remindersSent: 0
    };

    this.records.set(id, record);
    return record;
  }

  findById(id: string): GrayConfigRecycle | undefined {
    return this.records.get(id);
  }

  query(request: QueryRecycleRequest): QueryRecycleResponse {
    const page = request.page || 1;
    const pageSize = request.pageSize || 10;
    
    let results = Array.from(this.records.values());

    if (request.configKey) {
      results = results.filter(r => r.configKey.includes(request.configKey!));
    }
    if (request.owner) {
      results = results.filter(r => r.owner === request.owner);
    }
    if (request.status) {
      results = results.filter(r => r.status === request.status);
    }

    results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = results.length;
    const start = (page - 1) * pageSize;
    const data = results.slice(start, start + pageSize);

    return {
      data,
      total,
      page,
      pageSize
    };
  }

  updateStatus(id: string, status: RecycleStatus, operator: string, remark?: string): GrayConfigRecycle | null {
    const record = this.records.get(id);
    if (!record) return null;

    record.status = status;
    record.updatedAt = new Date();
    
    if (status === RecycleStatus.COMPLETED) {
      record.report = {
        recycledCount: record.hitTenants.length,
        failedCount: 0,
        details: record.hitTenants.map(tenantId => ({
          tenantId,
          status: 'success' as const
        })),
        completedAt: new Date()
      };
    }

    return record;
  }

  addException(id: string, originalInput: any, errorMessage: string): ExceptionRecord | null {
    const record = this.records.get(id);
    if (!record) return null;

    const exception: ExceptionRecord = {
      id: uuidv4(),
      originalInput: JSON.parse(JSON.stringify(originalInput)),
      errorMessage,
      handler: '',
      handledAt: new Date(),
      resolution: ''
    };

    record.exceptions.push(exception);
    record.status = RecycleStatus.ERROR;
    record.updatedAt = new Date();

    return exception;
  }

  handleException(id: string, exceptionId: string, handler: string, resolution: string): GrayConfigRecycle | null {
    const record = this.records.get(id);
    if (!record) return null;

    const exception = record.exceptions.find(e => e.id === exceptionId);
    if (!exception) return null;

    exception.handler = handler;
    exception.resolution = resolution;
    exception.handledAt = new Date();
    
    record.status = RecycleStatus.PENDING;
    record.updatedAt = new Date();

    return record;
  }

  manualCorrection(id: string, updates: Partial<GrayConfigRecycle>, operator: string, reason: string): GrayConfigRecycle | null {
    const record = this.records.get(id);
    if (!record) return null;

    const originalInput = JSON.parse(JSON.stringify({
      id: record.id,
      configKey: record.configKey,
      grayScope: record.grayScope,
      owner: record.owner,
      recycleDate: record.recycleDate,
      hitTenants: record.hitTenants,
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    }));

    if (updates.configKey !== undefined) record.configKey = updates.configKey;
    if (updates.grayScope !== undefined) record.grayScope = updates.grayScope;
    if (updates.owner !== undefined) record.owner = updates.owner;
    if (updates.recycleDate !== undefined) record.recycleDate = updates.recycleDate;
    if (updates.hitTenants !== undefined) record.hitTenants = updates.hitTenants;

    record.updatedAt = new Date();

    const exception: ExceptionRecord = {
      id: uuidv4(),
      originalInput,
      errorMessage: `Manual correction by ${operator}: ${reason}`,
      handler: operator,
      handledAt: new Date(),
      resolution: reason
    };
    record.exceptions.push(exception);

    return record;
  }

  getAll(): GrayConfigRecycle[] {
    return Array.from(this.records.values());
  }

  updateHitTenants(id: string, tenants: string[]): GrayConfigRecycle | null {
    const record = this.records.get(id);
    if (!record) return null;
    
    record.hitTenants = tenants;
    record.updatedAt = new Date();
    return record;
  }

  incrementReminder(id: string): GrayConfigRecycle | null {
    const record = this.records.get(id);
    if (!record) return null;
    
    record.remindersSent += 1;
    record.lastReminderAt = new Date();
    record.updatedAt = new Date();
    return record;
  }
}

export const recycleStore = new RecycleStore();
