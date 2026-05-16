import { v4 as uuidv4 } from 'uuid';

export interface InMemoryRule {
  id: string;
  name: string;
  description: string;
  version: number;
  logic: any;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  createdBy: string;
}

export interface InMemoryBatchItem {
  id: string;
  batchId: string;
  originalData: any;
  processedData?: any;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  validationErrors?: any[];
  isFailed: boolean;
  createdAt: Date;
  processedAt?: Date;
}

export interface InMemoryBatch {
  id: string;
  name: string;
  description?: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILED' | 'REVIEWED';
  ruleVersionId: string;
  totalCount: number;
  successCount: number;
  failedCount: number;
  partialSuccess: boolean;
  executionTimeMs?: number;
  createdAt: Date;
  executedAt?: Date;
  createdBy: string;
  items: InMemoryBatchItem[];
}

export interface InMemoryFailedItem {
  id: string;
  batchId: string;
  batchItemId: string;
  originalData: any;
  failureReason: string;
  errorDetails: any[];
  reviewStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewComment?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
}

export interface InMemoryAuditLog {
  id: string;
  batchId?: string;
  batchItemId?: string;
  action: string;
  operator: string;
  beforeData?: any;
  afterData?: any;
  comment?: string;
  createdAt: Date;
}

export class InMemoryDatabase {
  rules: InMemoryRule[] = [];
  batches: InMemoryBatch[] = [];
  failedItems: InMemoryFailedItem[] = [];
  auditLogs: InMemoryAuditLog[] = [];

  constructor() {
    this.initializeDefaultData();
  }

  private initializeDefaultData() {
    this.rules.push({
      id: uuidv4(),
      name: '默认审批校验规则',
      description: '包含审批意见缺失检测等核心校验规则',
      version: 1,
      logic: {
        conditions: [
          { field: 'approvalStatus', operator: 'in', value: ['APPROVED', 'REJECTED'] },
          { field: 'approvalComment', operator: 'notEmpty' },
        ],
        actions: [{ type: 'BLOCK', message: '审批状态为通过/拒绝时，审批意见不能为空' }],
        approvalRequired: false,
      },
      status: 'ACTIVE',
      createdAt: new Date(),
      createdBy: 'system',
    });
  }

  getActiveRule(): InMemoryRule | undefined {
    return this.rules.find(r => r.status === 'ACTIVE');
  }

  getRuleById(id: string): InMemoryRule | undefined {
    return this.rules.find(r => r.id === id);
  }

  getAllRules(): InMemoryRule[] {
    return [...this.rules];
  }

  createRule(data: Omit<InMemoryRule, 'id' | 'createdAt'>): InMemoryRule {
    const rule: InMemoryRule = {
      ...data,
      id: uuidv4(),
      createdAt: new Date(),
    };
    this.rules.push(rule);
    return rule;
  }

  createBatch(data: {
    name: string;
    description?: string;
    inputData: any[];
    createdBy: string;
    ruleVersionId: string;
  }): InMemoryBatch {
    const batchId = uuidv4();
    const items: InMemoryBatchItem[] = data.inputData.map(item => ({
      id: uuidv4(),
      batchId,
      originalData: item,
      status: 'PENDING' as const,
      isFailed: false,
      createdAt: new Date(),
    }));

    const batch: InMemoryBatch = {
      id: batchId,
      name: data.name,
      description: data.description,
      status: 'PENDING',
      ruleVersionId: data.ruleVersionId,
      totalCount: items.length,
      successCount: 0,
      failedCount: 0,
      partialSuccess: false,
      createdAt: new Date(),
      createdBy: data.createdBy,
      items,
    };

    this.batches.push(batch);
    this.auditLogs.push({
      id: uuidv4(),
      batchId,
      action: 'BATCH_CREATED',
      operator: data.createdBy,
      comment: `创建批次，共 ${items.length} 条数据`,
      createdAt: new Date(),
    });

    return batch;
  }

  getBatchById(id: string): InMemoryBatch | undefined {
    return this.batches.find(b => b.id === id);
  }

  getBatches(params?: { status?: string; page?: number; pageSize?: number }): { data: InMemoryBatch[]; total: number } {
    let filtered = [...this.batches];
    if (params?.status) {
      filtered = filtered.filter(b => b.status === params.status);
    }
    
    const total = filtered.length;
    const page = params?.page || 1;
    const pageSize = params?.pageSize || 20;
    const skip = (page - 1) * pageSize;
    
    return {
      data: filtered.slice(skip, skip + pageSize),
      total,
    };
  }

  updateBatch(id: string, data: Partial<InMemoryBatch>): InMemoryBatch | undefined {
    const index = this.batches.findIndex(b => b.id === id);
    if (index !== -1) {
      this.batches[index] = { ...this.batches[index], ...data };
      return this.batches[index];
    }
    return undefined;
  }

  updateBatchItem(batchId: string, itemId: string, data: Partial<InMemoryBatchItem>): void {
    const batch = this.batches.find(b => b.id === batchId);
    if (batch) {
      const itemIndex = batch.items.findIndex(i => i.id === itemId);
      if (itemIndex !== -1) {
        batch.items[itemIndex] = { ...batch.items[itemIndex], ...data };
      }
    }
  }

  createFailedItem(data: Omit<InMemoryFailedItem, 'id'>): InMemoryFailedItem {
    const failedItem: InMemoryFailedItem = {
      ...data,
      id: uuidv4(),
    };
    this.failedItems.push(failedItem);
    return failedItem;
  }

  getFailedItemsByBatch(batchId: string): InMemoryFailedItem[] {
    return this.failedItems.filter(f => f.batchId === batchId);
  }

  updateFailedItem(id: string, data: Partial<InMemoryFailedItem>): InMemoryFailedItem | undefined {
    const index = this.failedItems.findIndex(f => f.id === id);
    if (index !== -1) {
      this.failedItems[index] = { ...this.failedItems[index], ...data };
      return this.failedItems[index];
    }
    return undefined;
  }

  addAuditLog(log: Omit<InMemoryAuditLog, 'id' | 'createdAt'>): InMemoryAuditLog {
    const newLog: InMemoryAuditLog = {
      ...log,
      id: uuidv4(),
      createdAt: new Date(),
    };
    this.auditLogs.push(newLog);
    return newLog;
  }

  getAuditLogs(params?: { batchId?: string; page?: number; pageSize?: number }): { data: InMemoryAuditLog[]; total: number } {
    let filtered = [...this.auditLogs];
    if (params?.batchId) {
      filtered = filtered.filter(l => l.batchId === params.batchId);
    }
    
    const total = filtered.length;
    const page = params?.page || 1;
    const pageSize = params?.pageSize || 50;
    const skip = (page - 1) * pageSize;
    
    return {
      data: filtered.slice(skip, skip + pageSize),
      total,
    };
  }
}

export const inMemoryDb = new InMemoryDatabase();
