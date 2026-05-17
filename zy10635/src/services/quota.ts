import { AppDataSource } from '../app';
import { QuotaGroup, QuotaStatus } from '../models/QuotaGroup';
import { stateValidator } from './stateValidator';
import { operationLogService } from './operationLog';
import { surveyService } from './survey';

export class QuotaService {
  private repository = AppDataSource.getRepository(QuotaGroup);

  async create(data: Partial<QuotaGroup>, operator: string): Promise<QuotaGroup> {
    const quota = this.repository.create(data);
    const saved = await this.repository.save(quota);
    await operationLogService.log('quota', saved.id, 'create', operator, undefined, data);
    await surveyService.updateSampleCounts(saved.surveyId);
    return saved;
  }

  async findAll(surveyId?: number): Promise<QuotaGroup[]> {
    const where = surveyId ? { surveyId } : {};
    return await this.repository.find({
      where,
      relations: ['samples'],
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: number): Promise<QuotaGroup | null> {
    return await this.repository.findOne({
      where: { id },
      relations: ['samples', 'survey'],
    });
  }

  async update(id: number, data: Partial<QuotaGroup>, operator: string): Promise<QuotaGroup | null> {
    const quota = await this.findById(id);
    if (!quota) return null;

    const oldValue = { ...quota };
    Object.assign(quota, data);
    const saved = await this.repository.save(quota);
    await operationLogService.log('quota', id, 'update', operator, oldValue, data);
    await surveyService.updateSampleCounts(saved.surveyId);
    return saved;
  }

  async updateStatus(id: number, newStatus: QuotaStatus, operator: string, remark?: string): Promise<QuotaGroup | null> {
    const quota = await this.findById(id);
    if (!quota) return null;

    if (!stateValidator.canTransitionQuota(quota.status, newStatus)) {
      throw new Error(`Invalid status transition: ${quota.status} -> ${newStatus}`);
    }

    const oldValue = { status: quota.status };
    quota.status = newStatus;
    if (remark) {
      quota.remark = remark;
    }
    const saved = await this.repository.save(quota);
    await operationLogService.log('quota', id, 'status_change', operator, oldValue, { status: newStatus }, remark);
    return saved;
  }

  async incrementCurrentCount(id: number, operator: string): Promise<QuotaGroup | null> {
    const quota = await this.findById(id);
    if (!quota) return null;

    const oldValue = { currentCount: quota.currentCount, status: quota.status };
    quota.currentCount += 1;

    if (quota.currentCount >= quota.targetCount && quota.status === QuotaStatus.COLLECTING) {
      quota.status = QuotaStatus.QUOTA_FULL;
    }

    const saved = await this.repository.save(quota);
    await operationLogService.log('quota', id, 'increment_count', operator, oldValue, { currentCount: quota.currentCount, status: quota.status });
    await surveyService.updateSampleCounts(saved.surveyId);
    return saved;
  }

  async handleInvalidSample(id: number, operator: string): Promise<QuotaGroup | null> {
    const quota = await this.findById(id);
    if (!quota) return null;

    const oldValue = { 
      currentCount: quota.currentCount, 
      invalidCount: quota.invalidCount,
      status: quota.status 
    };
    
    if (quota.currentCount > 0) {
      quota.currentCount -= 1;
    }
    quota.invalidCount += 1;

    const saved = await this.repository.save(quota);
    await operationLogService.log('quota', id, 'invalid_sample', operator, oldValue, { 
      currentCount: quota.currentCount, 
      invalidCount: quota.invalidCount,
      status: quota.status 
    });
    await surveyService.updateSampleCounts(saved.surveyId);
    return saved;
  }

  async reopenAfterInvalidate(id: number, operator: string, remark: string): Promise<QuotaGroup | null> {
    const quota = await this.findById(id);
    if (!quota) return null;

    if (!stateValidator.canReopenQuota(quota.status)) {
      throw new Error('Cannot reopen quota in current state');
    }

    const oldValue = { status: quota.status };
    quota.status = QuotaStatus.COLLECTING;
    quota.remark = remark;
    const saved = await this.repository.save(quota);
    await operationLogService.log('quota', id, 'reopen', operator, oldValue, { status: QuotaStatus.COLLECTING }, remark);
    return saved;
  }
}

export const quotaService = new QuotaService();