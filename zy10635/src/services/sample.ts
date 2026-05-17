import { AppDataSource } from '../app';
import { Sample, SampleStatus, SampleSource } from '../models/Sample';
import { stateValidator } from './stateValidator';
import { operationLogService } from './operationLog';
import { quotaService } from './quota';
import { surveyService } from './survey';
import { Parser } from 'json2csv';

export class SampleService {
  private repository = AppDataSource.getRepository(Sample);

  async create(data: Partial<Sample>, operator: string): Promise<Sample> {
    const sample = this.repository.create(data);
    const saved = await this.repository.save(sample);
    await operationLogService.log('sample', saved.id, 'create', operator, undefined, data);
    
    if (saved.quotaGroupId && saved.status === SampleStatus.VALID) {
      await quotaService.incrementCurrentCount(saved.quotaGroupId, operator);
    }
    
    return saved;
  }

  async findAll(surveyId?: number, quotaGroupId?: number, status?: SampleStatus): Promise<Sample[]> {
    const where: any = {};
    if (surveyId) where.surveyId = surveyId;
    if (quotaGroupId) where.quotaGroupId = quotaGroupId;
    if (status) where.status = status;

    return await this.repository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: number): Promise<Sample | null> {
    return await this.repository.findOne({
      where: { id },
      relations: ['quotaGroup', 'survey'],
    });
  }

  async update(id: number, data: Partial<Sample>, operator: string): Promise<Sample | null> {
    const sample = await this.findById(id);
    if (!sample) return null;

    const oldValue = { ...sample };
    Object.assign(sample, data);
    const saved = await this.repository.save(sample);
    await operationLogService.log('sample', id, 'update', operator, oldValue, data);
    return saved;
  }

  async markAsInvalid(id: number, reason: string, operator: string, remark?: string): Promise<Sample | null> {
    const sample = await this.findById(id);
    if (!sample) return null;

    if (!stateValidator.canInvalidateSample(sample.status)) {
      throw new Error('Cannot invalidate sample in current state');
    }

    const oldValue = { status: sample.status, invalidReason: sample.invalidReason };
    sample.status = SampleStatus.INVALID;
    sample.invalidReason = reason;
    if (remark) {
      sample.remark = remark;
    }

    const saved = await this.repository.save(sample);
    await operationLogService.log('sample', id, 'mark_invalid', operator, oldValue, { 
      status: SampleStatus.INVALID, 
      invalidReason: reason 
    }, remark);

    if (saved.quotaGroupId) {
      await quotaService.handleInvalidSample(saved.quotaGroupId, operator);
    }

    return saved;
  }

  async markAsValid(id: number, operator: string, remark?: string): Promise<Sample | null> {
    const sample = await this.findById(id);
    if (!sample) return null;

    if (!stateValidator.canTransitionSample(sample.status, SampleStatus.VALID)) {
      throw new Error('Cannot mark sample as valid');
    }

    const oldValue = { status: sample.status };
    sample.status = SampleStatus.VALID;
    if (remark) {
      sample.remark = remark;
    }

    const saved = await this.repository.save(sample);
    await operationLogService.log('sample', id, 'mark_valid', operator, oldValue, { status: SampleStatus.VALID }, remark);

    if (saved.quotaGroupId) {
      await quotaService.incrementCurrentCount(saved.quotaGroupId, operator);
    }

    return saved;
  }

  async importSamples(surveyId: number, samplesData: any[], operator: string): Promise<{ success: Sample[], errors: any[] }> {
    const success: Sample[] = [];
    const errors: any[] = [];

    for (let i = 0; i < samplesData.length; i++) {
      try {
        const data = samplesData[i];
        if (!data.respondentId) {
          throw new Error('Missing respondentId');
        }

        const sample = await this.create({
          surveyId,
          quotaGroupId: data.quotaGroupId,
          respondentId: data.respondentId,
          status: data.status || SampleStatus.PENDING,
          source: SampleSource.IMPORT,
          data: data,
          remark: data.remark,
        }, operator);

        success.push(sample);
      } catch (error: any) {
        errors.push({
          row: i + 1,
          data: samplesData[i],
          error: error.message,
        });
      }
    }

    return { success, errors };
  }

  async exportSamples(surveyId: number): Promise<string> {
    const samples = await this.findAll(surveyId);
    const parser = new Parser({
      fields: ['id', 'respondentId', 'status', 'source', 'isResample', 'invalidReason', 'remark', 'createdAt'],
    });
    return parser.parse(samples);
  }
}

export const sampleService = new SampleService();