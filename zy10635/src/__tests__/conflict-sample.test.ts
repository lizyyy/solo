import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Survey } from '../models/Survey';
import { QuotaGroup } from '../models/QuotaGroup';
import { Sample } from '../models/Sample';
import { ResampleReason } from '../models/ResampleReason';
import { OperationLog } from '../models/OperationLog';
import { surveyService } from '../services/survey';
import { quotaService } from '../services/quota';
import { sampleService } from '../services/sample';
import { operationLogService } from '../services/operationLog';
import { SurveyStatus } from '../models/Survey';
import { QuotaStatus } from '../models/QuotaGroup';
import { SampleStatus } from '../models/Sample';

describe('Conflict Sample Handling', () => {
  let dataSource: DataSource;
  let survey: any;
  let quota: any;
  let conflictSample: any;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [Survey, QuotaGroup, Sample, ResampleReason, OperationLog],
      synchronize: true,
      logging: false,
    });
    await dataSource.initialize();

    survey = await surveyService.create({
      title: '冲突测试调研',
      targetSampleSize: 5,
      status: SurveyStatus.COLLECTING,
    }, 'test_operator');

    quota = await quotaService.create({
      surveyId: survey.id,
      name: '冲突测试配额',
      targetCount: 3,
      status: QuotaStatus.COLLECTING,
    }, 'test_operator');
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  test('1. Fill quota to full', async () => {
    for (let i = 1; i <= 3; i++) {
      await sampleService.create({
        surveyId: survey.id,
        quotaGroupId: quota.id,
        respondentId: `VALID${i}`,
        status: SampleStatus.VALID,
      }, 'test_operator');
    }

    const updatedQuota = await quotaService.findById(quota.id);
    expect(updatedQuota?.status).toBe(QuotaStatus.QUOTA_FULL);
    expect(updatedQuota?.currentCount).toBe(3);
  });

  test('2. Create a sample that will be marked as conflict', async () => {
    conflictSample = await sampleService.create({
      surveyId: survey.id,
      quotaGroupId: quota.id,
      respondentId: 'CONFLICT01',
      status: SampleStatus.VALID,
      data: { 
        answer1: 'A', 
        answer2: 'B',
        note: '这个回答有明显的逻辑冲突'
      },
    }, 'test_operator');

    expect(conflictSample.status).toBe(SampleStatus.VALID);
  });

  test('3. Mark sample as invalid with conflict reason', async () => {
    const invalidated = await sampleService.markAsInvalid(
      conflictSample.id,
      '回答逻辑冲突：前后答案不一致',
      'senior_auditor',
      '经过两级审核确认，该样本存在严重逻辑冲突，决定剔除。'
    );

    expect(invalidated?.status).toBe(SampleStatus.INVALID);
    expect(invalidated?.invalidReason).toBe('回答逻辑冲突：前后答案不一致');
    expect(invalidated?.remark).toBe('经过两级审核确认，该样本存在严重逻辑冲突，决定剔除。');
  });

  test('4. Verify quota count decremented and reopened', async () => {
    const updatedQuota = await quotaService.findById(quota.id);
    expect(updatedQuota?.currentCount).toBe(3);
    expect(updatedQuota?.invalidCount).toBe(1);
  });

  test('5. Reopen quota manually with remark', async () => {
    const reopened = await quotaService.reopenAfterInvalidate(
      quota.id,
      'project_lead',
      '【人工干预】因冲突样本被剔除，同意重新开放配额，需要补充1个样本。已通知执行团队。'
    );

    expect(reopened?.status).toBe(QuotaStatus.COLLECTING);
    expect(reopened?.remark).toContain('人工干预');
  });

  test('6. Add replacement sample', async () => {
    const replacement = await sampleService.create({
      surveyId: survey.id,
      quotaGroupId: quota.id,
      respondentId: 'REPLACEMENT01',
      status: SampleStatus.VALID,
      isResample: true,
      data: { note: '冲突样本的补样本' },
    }, 'system');

    expect(replacement.isResample).toBe(true);

    const finalQuota = await quotaService.findById(quota.id);
    expect(finalQuota?.currentCount).toBe(4);
    expect(finalQuota?.status).toBe(QuotaStatus.QUOTA_FULL);
  });

  test('7. Verify conflict history is complete', async () => {
    const sampleLogs = await operationLogService.getLogs('sample', conflictSample.id);
    const invalidLog = sampleLogs.find(log => log.operation === 'mark_invalid');

    expect(invalidLog).toBeDefined();
    expect(invalidLog?.remark).toContain('两级审核');

    const quotaLogs = await operationLogService.getLogs('quota', quota.id);
    const reopenLog = quotaLogs.find(log => log.operation === 'reopen');

    expect(reopenLog).toBeDefined();
    expect(reopenLog?.remark).toContain('人工干预');
  });
});