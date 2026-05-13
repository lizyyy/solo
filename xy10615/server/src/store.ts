import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import {
  LineChangePlan,
  MoldInspection,
  MaterialKitting,
  FirstArticleInspection,
  PersonQualification,
  MissingItem,
  StatusHistory,
  ChangeLog,
  IdempotentRequest
} from './types';

class DataStore {
  private static instance: DataStore;
  
  lineChangePlans: Map<string, LineChangePlan> = new Map();
  moldInspections: Map<string, MoldInspection> = new Map();
  materialKittings: Map<string, MaterialKitting> = new Map();
  firstArticleInspections: Map<string, FirstArticleInspection> = new Map();
  personQualifications: Map<string, PersonQualification> = new Map();
  missingItems: Map<string, MissingItem> = new Map();
  statusHistories: Map<string, StatusHistory> = new Map();
  changeLogs: Map<string, ChangeLog> = new Map();
  idempotentRequests: Map<string, IdempotentRequest> = new Map();

  private constructor() {}

  static getInstance(): DataStore {
    if (!DataStore.instance) {
      DataStore.instance = new DataStore();
    }
    return DataStore.instance;
  }

  generateId(): string {
    return uuidv4();
  }

  now(): string {
    return dayjs().toISOString();
  }

  checkIdempotent(requestId: string): { exists: boolean; result?: any } {
    const record = this.idempotentRequests.get(requestId);
    if (record && record.processed) {
      return { exists: true, result: record.result };
    }
    return { exists: false };
  }

  markIdempotent(requestId: string, entityType: string, action: string, result: any): void {
    this.idempotentRequests.set(requestId, {
      requestId,
      entityType,
      action,
      processed: true,
      result,
      createdAt: this.now()
    });
  }

  addStatusHistory(
    entityId: string,
    entityType: string,
    status: string,
    previousStatus: string | undefined,
    operator: string,
    operatorId: string,
    remark?: string
  ): void {
    const history: StatusHistory = {
      id: this.generateId(),
      entityId,
      entityType,
      status,
      previousStatus,
      operator,
      operatorId,
      remark,
      createdAt: this.now()
    };
    this.statusHistories.set(history.id, history);
  }

  addChangeLog(
    entityId: string,
    entityType: string,
    field: string,
    oldValue: any,
    newValue: any,
    operator: string,
    operatorId: string
  ): void {
    const log: ChangeLog = {
      id: this.generateId(),
      entityId,
      entityType,
      field,
      oldValue,
      newValue,
      operator,
      operatorId,
      createdAt: this.now()
    };
    this.changeLogs.set(log.id, log);
  }

  getStatusHistoriesByEntity(entityId: string): StatusHistory[] {
    return Array.from(this.statusHistories.values())
      .filter(h => h.entityId === entityId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getChangeLogsByEntity(entityId: string): ChangeLog[] {
    return Array.from(this.changeLogs.values())
      .filter(l => l.entityId === entityId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}

export const store = DataStore.getInstance();
