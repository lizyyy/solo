import { AppDataSource } from '../app';
import { ResampleReason, ResampleStatus } from '../models/ResampleReason';
import { QuotaStatus } from '../models/QuotaGroup';
import { SurveyStatus } from '../models/Survey';
import { stateValidator } from './stateValidator';
import { operationLogService } from './operationLog';
import { quotaService } from './quota';
import { surveyService } from './survey';

export class ResampleService {
  private repository = AppDataSource.getRepository(ResampleReason);

  async create(data: Partial<ResampleReason>, operator: string): Promise<ResampleReason> {
    const resample = this.repository.create({
      ...data,
      requestedBy: operator,
    });
    const saved = await this.repository.save(resample);
    await operationLogService.log('resample', saved.id, 'create', operator, undefined, data);
    return saved;
  }

  async findAll(surveyId?: number, quotaGroupId?: number): Promise<ResampleReason[]> {
    const where: any = {};
    if (surveyId) where.surveyId = surveyId;
    if (quotaGroupId) where.quotaGroupId = quotaGroupId;

    return await this.repository.find({
      where,
      relations: ['survey', 'quotaGroup'],
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: number): Promise<ResampleReason | null> {
    return await this.repository.findOne({
      where: { id },
      relations: ['survey', 'quotaGroup'],
    });
  }

  async approve(id: number, approvedCount: number, operator: string, remark?: string): Promise<ResampleReason | null> {
    const resample = await this.findById(id);
    if (!resample) return null;

    if (!stateValidator.canTransitionResample(resample.status, ResampleStatus.APPROVED)) {
      throw new Error('Cannot approve resample in current state');
    }

    const oldValue = { status: resample.status, approvedCount: resample.approvedCount };
    resample.status = ResampleStatus.APPROVED;
    resample.approvedCount = approvedCount;
    resample.approvedBy = operator;
    if (remark) {
      resample.remark = remark;
    }

    const saved = await this.repository.save(resample);
    await operationLogService.log('resample', id, 'approve', operator, oldValue, { 
      status: ResampleStatus.APPROVED, 
      approvedCount 
    }, remark);

    if (resample.quotaGroupId) {
      await quotaService.updateStatus(resample.quotaGroupId, QuotaStatus.RESAMPLING, operator, remark);
    }
    await surveyService.updateStatus(resample.surveyId, SurveyStatus.RESAMPLING, operator, remark);

    return saved;
  }

  async reject(id: number, operator: string, remark?: string): Promise<ResampleReason | null> {
    const resample = await this.findById(id);
    if (!resample) return null;

    if (!stateValidator.canTransitionResample(resample.status, ResampleStatus.REJECTED)) {
      throw new Error('Cannot reject resample in current state');
    }

    const oldValue = { status: resample.status };
    resample.status = ResampleStatus.REJECTED;
    resample.approvedBy = operator;
    if (remark) {
      resample.remark = remark;
    }

    const saved = await this.repository.save(resample);
    await operationLogService.log('resample', id, 'reject', operator, oldValue, { 
      status: ResampleStatus.REJECTED 
    }, remark);

    return saved;
  }

  async complete(id: number, operator: string, remark?: string): Promise<ResampleReason | null> {
    const resample = await this.findById(id);
    if (!resample) return null;

    if (!stateValidator.canTransitionResample(resample.status, ResampleStatus.COMPLETED)) {
      throw new Error('Cannot complete resample in current state');
    }

    const oldValue = { status: resample.status };
    resample.status = ResampleStatus.COMPLETED;
    if (remark) {
      resample.remark = remark;
    }

    const saved = await this.repository.save(resample);
    await operationLogService.log('resample', id, 'complete', operator, oldValue, { 
      status: ResampleStatus.COMPLETED 
    }, remark);

    if (resample.quotaGroupId) {
      const quota = await quotaService.findById(resample.quotaGroupId);
      if (quota && quota.currentCount >= quota.targetCount) {
        await quotaService.updateStatus(resample.quotaGroupId, QuotaStatus.QUOTA_FULL, operator, remark);
      } else {
        await quotaService.updateStatus(resample.quotaGroupId, QuotaStatus.COLLECTING, operator, remark);
      }
    }

    return saved;
  }
}

export const resampleService = new ResampleService();