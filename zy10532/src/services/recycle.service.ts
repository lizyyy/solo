import Joi from 'joi';
import { RecycleRepository } from '../database/repository';
import {
  RecycleStatus,
  RecycleAction,
  CreateRecycleRequest,
  QueryRecycleRequest,
  RecycleRecord,
  RecycleSummary
} from '../types';

const createSchema = Joi.object({
  tenantId: Joi.string().required(),
  featureId: Joi.string().required(),
  trialEndDate: Joi.string().isoDate().required(),
  recycleAction: Joi.string().valid(...Object.values(RecycleAction)).required(),
  createdBy: Joi.string().required(),
  rawInput: Joi.string().allow(null, '').optional()
});

export class RecycleService {
  private repository: RecycleRepository;

  constructor(repository: RecycleRepository) {
    this.repository = repository;
  }

  async createRecycleRecord(request: CreateRecycleRequest): Promise<RecycleRecord> {
    const { error } = createSchema.validate(request);
    if (error) {
      throw new Error(`Validation failed: ${error.message}`);
    }

    const tenant = await this.repository.getTenantById(request.tenantId);
    if (!tenant) {
      throw new Error(`Tenant ${request.tenantId} not found`);
    }

    const feature = await this.repository.getFeatureById(request.featureId);
    if (!feature) {
      throw new Error(`Feature ${request.featureId} not found`);
    }

    const existing = await this.repository.getRecycleRecords({ tenantId: request.tenantId, pageSize: 100 });
    const duplicate = existing.records.find(
      r => r.featureId === request.featureId && 
           r.status !== RecycleStatus.COMPLETED && 
           r.status !== RecycleStatus.CANCELLED
    );
    if (duplicate) {
      throw new Error(`Active recycle record already exists for feature ${request.featureId}`);
    }

    const isOverdue = new Date(request.trialEndDate) < new Date();
    const initialStatus = isOverdue ? RecycleStatus.PENDING_CONFIRM : RecycleStatus.PENDING_CONFIRM;

    const evidence = JSON.stringify({
      tenantName: tenant.tenantName,
      featureName: feature.featureName,
      isOverdue,
      daysOverdue: isOverdue ? Math.floor((Date.now() - new Date(request.trialEndDate).getTime()) / 86400000) : 0
    });

    const record = await this.repository.createRecycleRecord({
      ...request,
      status: initialStatus,
      processingEvidence: evidence
    });

    return record;
  }

  async getRecycleRecord(id: string): Promise<RecycleRecord | null> {
    return this.repository.getRecycleRecordById(id);
  }

  async queryRecycleRecords(query: QueryRecycleRequest) {
    return this.repository.getRecycleRecords(query);
  }

  async confirmSales(recordId: string, confirmedBy: string, note: string): Promise<void> {
    const record = await this.repository.getRecycleRecordById(recordId);
    if (!record) {
      throw new Error(`Record ${recordId} not found`);
    }
    if (record.status !== RecycleStatus.PENDING_CONFIRM) {
      throw new Error(`Record is not in pending_confirm status`);
    }
    await this.repository.updateSalesConfirm(recordId, confirmedBy, note, 'confirmed');
  }

  async denySalesConfirm(recordId: string, confirmedBy: string, note: string): Promise<void> {
    const record = await this.repository.getRecycleRecordById(recordId);
    if (!record) {
      throw new Error(`Record ${recordId} not found`);
    }
    await this.repository.updateSalesConfirm(recordId, confirmedBy, note, 'denied');
  }

  async sendReminder(recordId: string): Promise<void> {
    const record = await this.repository.getRecycleRecordById(recordId);
    if (!record) {
      throw new Error(`Record ${recordId} not found`);
    }
    await this.repository.incrementReminder(recordId);
  }

  async startRecycle(recordId: string): Promise<void> {
    const record = await this.repository.getRecycleRecordById(recordId);
    if (!record) {
      throw new Error(`Record ${recordId} not found`);
    }
    if (record.status !== RecycleStatus.CONFIRMED) {
      throw new Error(`Record must be confirmed before starting recycle`);
    }
    await this.repository.updateRecycleRecordStatus(recordId, RecycleStatus.IN_PROGRESS, 'Started by system');
  }

  async completeRecycle(recordId: string, recycledBy: string, note: string): Promise<void> {
    const record = await this.repository.getRecycleRecordById(recordId);
    if (!record) {
      throw new Error(`Record ${recordId} not found`);
    }
    if (record.status !== RecycleStatus.IN_PROGRESS) {
      throw new Error(`Record must be in progress before completing`);
    }
    const tenant = await this.repository.getTenantById(record.tenantId);
    const feature = await this.repository.getFeatureById(record.featureId);
    const summary = `回收完成 | 客户: ${tenant?.tenantName || '未知'} | 功能: ${feature?.featureName || '未知'} | 动作: ${record.recycleAction} | 处理人: ${recycledBy} | 备注: ${note}`;
    await this.repository.completeRecycle(recordId, recycledBy, note, summary);
  }

  async applyExtension(recordId: string, days: number, reason: string, extendedBy: string): Promise<void> {
    const record = await this.repository.getRecycleRecordById(recordId);
    if (!record) {
      throw new Error(`Record ${recordId} not found`);
    }
    if (days <= 0 || days > 180) {
      throw new Error(`Extension days must be between 1 and 180`);
    }
    await this.repository.applyExtension(recordId, days, reason, extendedBy);
  }

  async handleException(recordId: string, errorType: string, errorMessage: string, rawInput: string, processingEvidence: string): Promise<void> {
    const record = await this.repository.getRecycleRecordById(recordId);
    if (!record) {
      throw new Error(`Record ${recordId} not found`);
    }
    await this.repository.updateRecycleRecordStatus(recordId, RecycleStatus.EXCEPTION, errorMessage);
    await this.repository.createException({
      recycleRecordId: recordId,
      errorType,
      errorMessage,
      rawInput,
      processingEvidence
    });
  }

  async getExceptions(recordId?: string) {
    return this.repository.getExceptions(recordId);
  }

  async resolveException(exceptionId: string, resolvedBy: string, note: string): Promise<void> {
    await this.repository.resolveException(exceptionId, resolvedBy, note);
  }

  async manualUpdate(recordId: string, updates: Partial<RecycleRecord>, modifiedBy: string): Promise<void> {
    const record = await this.repository.getRecycleRecordById(recordId);
    if (!record) {
      throw new Error(`Record ${recordId} not found`);
    }
    await this.repository.manualUpdateRecord(recordId, updates, modifiedBy);
  }

  async getSummary(): Promise<RecycleSummary> {
    const allRecords = await this.repository.getAllRecycleRecords();
    const now = new Date();
    
    let overdueDays = 0;
    allRecords.forEach(r => {
      if (r.status !== RecycleStatus.COMPLETED && r.status !== RecycleStatus.CANCELLED && r.status !== RecycleStatus.EXTENDED) {
        const endDate = new Date(r.trialEndDate);
        if (endDate < now) {
          overdueDays += Math.floor((now.getTime() - endDate.getTime()) / 86400000);
        }
      }
    });

    return {
      totalRecords: allRecords.length,
      pendingConfirm: allRecords.filter(r => r.status === RecycleStatus.PENDING_CONFIRM).length,
      confirmed: allRecords.filter(r => r.status === RecycleStatus.CONFIRMED).length,
      inProgress: allRecords.filter(r => r.status === RecycleStatus.IN_PROGRESS).length,
      completed: allRecords.filter(r => r.status === RecycleStatus.COMPLETED).length,
      extended: allRecords.filter(r => r.status === RecycleStatus.EXTENDED).length,
      exception: allRecords.filter(r => r.status === RecycleStatus.EXCEPTION).length,
      overdueDays
    };
  }

  async exportRecords(): Promise<RecycleRecord[]> {
    return this.repository.getAllRecycleRecords();
  }

  async createSeedData(): Promise<void> {
    const tenants = [
      { tenantId: 'T001', tenantName: '北京科技有限公司', customerName: '张三', salesPerson: '销售A' },
      { tenantId: 'T002', tenantName: '上海贸易集团', customerName: '李四', salesPerson: '销售B' },
      { tenantId: 'T003', tenantName: '广州电子科技', customerName: '王五', salesPerson: '销售A' },
      { tenantId: 'T004', tenantName: '深圳创新公司', customerName: '赵六', salesPerson: '销售C' },
      { tenantId: 'T005', tenantName: '杭州互联网公司', customerName: '钱七', salesPerson: '销售B' }
    ];

    for (const t of tenants) {
      try {
        await this.repository.createTenant(t);
      } catch (e) {}
    }

    const now = new Date();
    const features = [
      { tenantId: 'T001', featureCode: 'AI_001', featureName: 'AI智能分析', trialStartDate: new Date(now.getTime() - 45 * 86400000).toISOString().split('T')[0], trialEndDate: new Date(now.getTime() - 15 * 86400000).toISOString().split('T')[0], originalEndDate: new Date(now.getTime() - 15 * 86400000).toISOString().split('T')[0], grantedBy: 'admin', isActive: true },
      { tenantId: 'T001', featureCode: 'REPORT_001', featureName: '高级报表', trialStartDate: new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0], trialEndDate: new Date(now.getTime() + 15 * 86400000).toISOString().split('T')[0], originalEndDate: new Date(now.getTime() + 15 * 86400000).toISOString().split('T')[0], grantedBy: 'admin', isActive: true },
      { tenantId: 'T002', featureCode: 'API_001', featureName: 'API高级调用', trialStartDate: new Date(now.getTime() - 60 * 86400000).toISOString().split('T')[0], trialEndDate: new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0], originalEndDate: new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0], grantedBy: 'admin', isActive: true },
      { tenantId: 'T003', featureCode: 'STORAGE_001', featureName: '大容量存储', trialStartDate: new Date(now.getTime() - 20 * 86400000).toISOString().split('T')[0], trialEndDate: new Date(now.getTime() - 5 * 86400000).toISOString().split('T')[0], originalEndDate: new Date(now.getTime() - 5 * 86400000).toISOString().split('T')[0], grantedBy: 'admin', isActive: true },
      { tenantId: 'T004', featureCode: 'SECURITY_001', featureName: '安全审计', trialStartDate: new Date(now.getTime() - 50 * 86400000).toISOString().split('T')[0], trialEndDate: new Date(now.getTime() - 20 * 86400000).toISOString().split('T')[0], originalEndDate: new Date(now.getTime() - 20 * 86400000).toISOString().split('T')[0], grantedBy: 'admin', isActive: true }
    ];

    const createdFeatures: any[] = [];
    for (const f of features) {
      try {
        const feat = await this.repository.createTrialFeature(f);
        createdFeatures.push(feat);
      } catch (e) {}
    }
  }
}
