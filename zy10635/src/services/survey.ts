import { AppDataSource } from '../app';
import { Survey, SurveyStatus } from '../models/Survey';
import { QuotaGroup, QuotaStatus } from '../models/QuotaGroup';
import { stateValidator } from './stateValidator';
import { operationLogService } from './operationLog';

export class SurveyService {
  private repository = AppDataSource.getRepository(Survey);
  private quotaRepository = AppDataSource.getRepository(QuotaGroup);

  async create(data: Partial<Survey>, operator: string): Promise<Survey> {
    const survey = this.repository.create(data);
    const saved = await this.repository.save(survey);
    await operationLogService.log('survey', saved.id, 'create', operator, undefined, data);
    return saved;
  }

  async findAll(): Promise<Survey[]> {
    return await this.repository.find({
      relations: ['quotaGroups'],
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: number): Promise<Survey | null> {
    return await this.repository.findOne({
      where: { id },
      relations: ['quotaGroups'],
    });
  }

  async update(id: number, data: Partial<Survey>, operator: string): Promise<Survey | null> {
    const survey = await this.findById(id);
    if (!survey) return null;

    const oldValue = { ...survey };
    Object.assign(survey, data);
    const saved = await this.repository.save(survey);
    await operationLogService.log('survey', id, 'update', operator, oldValue, data);
    return saved;
  }

  async updateStatus(id: number, newStatus: SurveyStatus, operator: string, remark?: string): Promise<Survey | null> {
    const survey = await this.findById(id);
    if (!survey) return null;

    if (!stateValidator.canTransitionSurvey(survey.status, newStatus)) {
      throw new Error(`Invalid status transition: ${survey.status} -> ${newStatus}`);
    }

    const oldValue = { status: survey.status };
    survey.status = newStatus;
    if (remark) {
      survey.remark = remark;
    }
    const saved = await this.repository.save(survey);
    await operationLogService.log('survey', id, 'status_change', operator, oldValue, { status: newStatus }, remark);
    return saved;
  }

  async updateSampleCounts(surveyId: number): Promise<void> {
    const quotas = await this.quotaRepository.find({ where: { surveyId } });
    const totalValid = quotas.reduce((sum, q) => sum + q.currentCount, 0);
    
    await this.repository.update(surveyId, {
      currentSampleSize: totalValid,
    });

    const survey = await this.findById(surveyId);
    if (survey && totalValid >= survey.targetSampleSize && survey.status === SurveyStatus.COLLECTING) {
      await this.updateStatus(surveyId, SurveyStatus.QUOTA_FULL, 'system');
    }
  }

  async reopenAfterInvalidate(id: number, operator: string, remark: string): Promise<Survey | null> {
    const survey = await this.findById(id);
    if (!survey) return null;

    if (!stateValidator.canReopenQuota(survey.status as unknown as QuotaStatus)) {
      throw new Error('Cannot reopen survey in current state');
    }

    const oldValue = { status: survey.status };
    survey.status = SurveyStatus.COLLECTING;
    survey.remark = remark;
    const saved = await this.repository.save(survey);
    await operationLogService.log('survey', id, 'reopen', operator, oldValue, { status: SurveyStatus.COLLECTING }, remark);
    return saved;
  }
}

export const surveyService = new SurveyService();