import { v4 as uuidv4 } from 'uuid';

export enum WhitelistStatus {
  PENDING_APPROVAL = 'pending_approval',
  ACTIVE = 'active',
  EXPIRING_SOON = 'expiring_soon',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
  REJECTED = 'rejected'
}

export enum RateLimitUnit {
  SECOND = 'second',
  MINUTE = 'minute',
  HOUR = 'hour',
  DAY = 'day'
}

export interface RateLimitRule {
  maxRequests: number;
  unit: RateLimitUnit;
  burstLimit?: number;
}

export interface WhitelistRecord {
  id: string;
  tenantId: string;
  tenantName: string;
  apiGroupId: string;
  apiGroupName: string;
  rateLimitRule: RateLimitRule;
  effectiveDate: Date;
  expiryDate: Date;
  status: WhitelistStatus;
  applicant: string;
  approver?: string;
  reason: string;
  remark?: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export interface WhitelistHistory {
  id: string;
  recordId: string;
  action: string;
  operator: string;
  oldValue?: Partial<WhitelistRecord>;
  newValue?: Partial<WhitelistRecord>;
  remark?: string;
  operatedAt: Date;
}

export interface CreateWhitelistRequest {
  tenantId: string;
  tenantName: string;
  apiGroupId: string;
  apiGroupName: string;
  rateLimitRule: RateLimitRule;
  effectiveDate: Date;
  expiryDate: Date;
  applicant: string;
  reason: string;
  remark?: string;
}

export interface ApproveWhitelistRequest {
  approver: string;
  remark?: string;
}

export interface UpdateWhitelistRequest {
  rateLimitRule?: RateLimitRule;
  effectiveDate?: Date;
  expiryDate?: Date;
  reason?: string;
  remark?: string;
}

export class WhitelistModel {
  private records: Map<string, WhitelistRecord> = new Map();
  private histories: Map<string, WhitelistHistory> = new Map();
  private historyByRecordId: Map<string, string[]> = new Map();

  create(request: CreateWhitelistRequest): WhitelistRecord {
    const now = new Date();
    const record: WhitelistRecord = {
      id: uuidv4(),
      ...request,
      status: WhitelistStatus.PENDING_APPROVAL,
      createdAt: now,
      updatedAt: now,
      version: 1
    };

    this.records.set(record.id, record);
    this.addHistory(record.id, 'CREATE', request.applicant, undefined, record);
    return record;
  }

  findById(id: string): WhitelistRecord | undefined {
    return this.records.get(id);
  }

  findAll(filters?: {
    tenantId?: string;
    apiGroupId?: string;
    status?: WhitelistStatus;
  }): WhitelistRecord[] {
    let result = Array.from(this.records.values());

    if (filters?.tenantId) {
      result = result.filter(r => r.tenantId === filters.tenantId);
    }
    if (filters?.apiGroupId) {
      result = result.filter(r => r.apiGroupId === filters.apiGroupId);
    }
    if (filters?.status) {
      result = result.filter(r => r.status === filters.status);
    }

    return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  findByTenantAndApiGroup(tenantId: string, apiGroupId: string): WhitelistRecord[] {
    return this.findAll().filter(
      r => r.tenantId === tenantId && r.apiGroupId === apiGroupId
    );
  }

  update(id: string, updates: UpdateWhitelistRequest, operator: string): WhitelistRecord | undefined {
    const record = this.records.get(id);
    if (!record) return undefined;

    const oldValue = { ...record };
    const updatedRecord: WhitelistRecord = {
      ...record,
      ...updates,
      updatedAt: new Date(),
      version: record.version + 1
    };

    this.records.set(id, updatedRecord);
    this.addHistory(id, 'UPDATE', operator, oldValue, updatedRecord);
    return updatedRecord;
  }

  updateStatus(id: string, status: WhitelistStatus, operator: string, remark?: string): WhitelistRecord | undefined {
    const record = this.records.get(id);
    if (!record) return undefined;

    const oldValue = { ...record };
    const updatedRecord: WhitelistRecord = {
      ...record,
      status,
      updatedAt: new Date(),
      version: record.version + 1
    };

    this.records.set(id, updatedRecord);
    this.addHistory(id, `STATUS_${status.toUpperCase()}`, operator, oldValue, updatedRecord, remark);
    return updatedRecord;
  }

  approve(id: string, approver: string, remark?: string): WhitelistRecord | undefined {
    const record = this.records.get(id);
    if (!record) return undefined;

    const oldValue = { ...record };
    const now = new Date();
    const updatedRecord: WhitelistRecord = {
      ...record,
      status: WhitelistStatus.ACTIVE,
      approver,
      updatedAt: now,
      version: record.version + 1
    };

    this.records.set(id, updatedRecord);
    this.addHistory(id, 'APPROVE', approver, oldValue, updatedRecord, remark);
    return updatedRecord;
  }

  reject(id: string, approver: string, remark?: string): WhitelistRecord | undefined {
    return this.updateStatus(id, WhitelistStatus.REJECTED, approver, remark);
  }

  revoke(id: string, operator: string, remark?: string): WhitelistRecord | undefined {
    return this.updateStatus(id, WhitelistStatus.REVOKED, operator, remark);
  }

  getHistories(recordId: string): WhitelistHistory[] {
    const historyIds = this.historyByRecordId.get(recordId) || [];
    return historyIds
      .map(id => this.histories.get(id))
      .filter((h): h is WhitelistHistory => h !== undefined)
      .sort((a, b) => b.operatedAt.getTime() - a.operatedAt.getTime());
  }

  private addHistory(
    recordId: string,
    action: string,
    operator: string,
    oldValue?: Partial<WhitelistRecord>,
    newValue?: Partial<WhitelistRecord>,
    remark?: string
  ): void {
    const history: WhitelistHistory = {
      id: uuidv4(),
      recordId,
      action,
      operator,
      oldValue,
      newValue,
      remark,
      operatedAt: new Date()
    };

    this.histories.set(history.id, history);

    if (!this.historyByRecordId.has(recordId)) {
      this.historyByRecordId.set(recordId, []);
    }
    this.historyByRecordId.get(recordId)!.push(history.id);
  }

  bulkImport(records: CreateWhitelistRequest[]): {
    success: WhitelistRecord[];
    failed: { row: number; error: string; data: CreateWhitelistRequest }[];
  } {
    const success: WhitelistRecord[] = [];
    const failed: { row: number; error: string; data: CreateWhitelistRequest }[] = [];

    records.forEach((data, index) => {
      try {
        const record = this.create(data);
        success.push(record);
      } catch (error) {
        failed.push({
          row: index + 1,
          error: error instanceof Error ? error.message : '未知错误',
          data
        });
      }
    });

    return { success, failed };
  }

  export(): WhitelistRecord[] {
    return this.findAll();
  }

  clear(): void {
    this.records.clear();
    this.histories.clear();
    this.historyByRecordId.clear();
  }
}

export const whitelistModel = new WhitelistModel();
