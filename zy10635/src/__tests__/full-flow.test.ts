import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Survey } from '../../models/Survey';
import { QuotaGroup } from '../../models/QuotaGroup';
import { Sample } from '../../models/Sample';
import { ResampleReason } from '../../models/ResampleReason';
import { OperationLog } from '../../models/OperationLog';
import { surveyService } from '../../services/survey';
import { quotaService } from '../../services/quota';
import { sampleService } from '../../services/sample';
import { resampleService } from '../../services/resample';
import { operationLogService } from '../../services/operationLog';
import { SurveyStatus } from '../../models/Survey';
import { QuotaStatus } from '../../models/QuotaGroup';
import { SampleStatus } from '../../models/Sample';
import { ResampleStatus } from '../../models/ResampleReason';

describe('Full Survey Flow', () => {
  let dataSource: DataSource;
  let survey: any;
  let quota: any;
  let sample: any;
  let resample: any;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [Survey, QuotaGroup, Sample, ResampleReason, OperationLog],
      synchronize: true,
      logging: false,
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  test('1. Create survey and verify initial state', async () => {
    survey = await surveyService.create({
      title: '测试调研',
      targetSampleSize: 10,
      status: SurveyStatus.COLLECTING,
    }, 'test_operator');

    expect(survey.status).toBe(SurveyStatus.COLLECTING);
    expect(survey.currentSampleSize).toBe(0);
  });

  test('2. Create quota group', async () => {
    quota = await quotaService.create({
      surveyId: survey.id,
      name: '测试配额组',
      targetCount: 5,
      status: QuotaStatus.COLLECTING,
    }, 'test_operator');

    expect(quota.targetCount).toBe(5);
    expect(quota.currentCount).toBe(0);
  });

  test('3. Add valid samples and verify count increment', async () => {
    for (let i = 1; i <= 5; i++) {
      await sampleService.create({
        surveyId: survey.id,
        quotaGroupId: quota.id,
        respondentId: `TEST${i}`,
        status: SampleStatus.VALID,
      }, 'test_operator');
    }

    const updatedQuota = await quotaService.findById(quota.id);
    expect(updatedQuota?.currentCount).toBe(5);
    expect(updatedQuota?.status).toBe(QuotaStatus.QUOTA_FULL);

    const updatedSurvey = await surveyService.findById(survey.id);
    expect(updatedSurvey?.currentSampleSize).toBe(5);
  });

  test('4. Invalidate a sample and verify count decrement', async () => {
    const samples = await sampleService.findAll(survey.id);
    sample = samples[0];

    const result = await sampleService.markAsInvalid(
      sample.id,
      '回答无效',
      'auditor',
      '经过审核确认该样本无效'
    );

    expect(result?.status).toBe(SampleStatus.INVALID);
    expect(result?.invalidReason).toBe('回答无效');

    const updatedQuota = await quotaService.findById(quota.id);
    expect(updatedQuota?.currentCount).toBe(4);
    expect(updatedQuota?.invalidCount).toBe(1);
  });

  test('5. Reopen quota group after invalidation', async () => {
    const updatedQuota = await quotaService.reopenAfterInvalidate(
      quota.id,
      'manager',
      '因无效样本，重新打开配额继续收集'
    );

    expect(updatedQuota?.status).toBe(QuotaStatus.COLLECTING);
    expect(updatedQuota?.remark).toBe('因无效样本，重新打开配额继续收集');
  });

  test('6. Create resample request', async () => {
    resample = await resampleService.create({
      surveyId: survey.id,
      quotaGroupId: quota.id,
      reason: '因无效样本需要补充',
      requestedCount: 2,
    }, 'project_manager');

    expect(resample.status).toBe(ResampleStatus.PENDING);
    expect(resample.requestedCount).toBe(2);
  });

  test('7. Approve resample and verify status change', async () => {
    const approved = await resampleService.approve(
      resample.id,
      1,
      'director',
      '批准补充1个样本'
    );

    expect(approved?.status).toBe(ResampleStatus.APPROVED);
    expect(approved?.approvedCount).toBe(1);

    const updatedQuota = await quotaService.findById(quota.id);
    expect(updatedQuota?.status).toBe(QuotaStatus.RESAMPLING);
  });

  test('8. Complete resample and verify final state', async () => {
    await sampleService.create({
      surveyId: survey.id,
      quotaGroupId: quota.id,
      respondentId: 'RESAMPLE01',
      status: SampleStatus.VALID,
      isResample: true,
    }, 'system');

    const completed = await resampleService.complete(
      resample.id,
      'project_manager',
      '补样完成，已达到目标数'
    );

    expect(completed?.status).toBe(ResampleStatus.COMPLETED);

    const finalQuota = await quotaService.findById(quota.id);
    expect(finalQuota?.currentCount).toBe(5);
  });

  test('9. Verify operation history exists', async () => {
    const surveyLogs = await operationLogService.getLogs('survey', survey.id);
    const quotaLogs = await operationLogService.getLogs('quota', quota.id);
    const sampleLogs = await operationLogService.getLogs('sample', sample.id);
    const resampleLogs = await operationLogService.getLogs('resample', resample.id);

    expect(surveyLogs.length).toBeGreaterThan(0);
    expect(quotaLogs.length).toBeGreaterThan(0);
    expect(sampleLogs.length).toBeGreaterThan(0);
    expect(resampleLogs.length).toBeGreaterThan(0);
  });

  test('10. List and detail verification', async () => {
    const allSurveys = await surveyService.findAll();
    const allQuotas = await quotaService.findAll(survey.id);
    const allSamples = await sampleService.findAll(survey.id);
    const allResamples = await resampleService.findAll(survey.id);

    expect(allSurveys.length).toBe(1);
    expect(allQuotas.length).toBe(1);
    expect(allSamples.length).toBe(6);
    expect(allResamples.length).toBe(1);
  });
});