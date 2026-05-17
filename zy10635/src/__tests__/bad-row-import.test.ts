import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Survey } from '../models/Survey';
import { QuotaGroup } from '../models/QuotaGroup';
import { Sample } from '../models/Sample';
import { ResampleReason } from '../models/ResampleReason';
import { OperationLog } from '../models/OperationLog';
import { surveyService } from '../services/survey';
import { sampleService } from '../services/sample';
import { SurveyStatus } from '../models/Survey';
import { SampleStatus } from '../models/Sample';

describe('Bad Row Import', () => {
  let dataSource: DataSource;
  let survey: any;

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
      title: '导入测试调研',
      targetSampleSize: 10,
      status: SurveyStatus.COLLECTING,
    }, 'test_operator');
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  test('1. Import with mixed good and bad rows', async () => {
    const importData = [
      { respondentId: 'GOOD001', name: '张三', status: 'valid' },
      { respondentId: 'GOOD002', name: '李四', status: 'valid' },
      { name: '王五', status: 'pending' },
      { respondentId: 'GOOD003', name: '赵六', status: 'valid' },
      { respondentId: null, name: '钱七' },
      { respondentId: 'GOOD004', name: '孙八', status: 'pending' },
      {},
      { respondentId: 'GOOD005', name: '周九' },
    ];

    const result = await sampleService.importSamples(
      survey.id,
      importData,
      'import_operator'
    );

    expect(result.success.length).toBe(5);
    expect(result.errors.length).toBe(3);
  });

  test('2. Verify error details contain row information', async () => {
    const importData = [
      { respondentId: 'GOOD001' },
      { name: '缺ID' },
      { respondentId: 'GOOD002' },
      {},
    ];

    const result = await sampleService.importSamples(
      survey.id,
      importData,
      'import_operator'
    );

    expect(result.errors[0].row).toBe(2);
    expect(result.errors[0].error).toBe('Missing respondentId');
    expect(result.errors[1].row).toBe(4);
  });

  test('3. Successfully imported samples are in valid state', async () => {
    const samples = await sampleService.findAll(survey.id);
    const validSamples = samples.filter(s => s.status === SampleStatus.VALID);
    
    expect(validSamples.length).toBeGreaterThan(0);
    validSamples.forEach(sample => {
      expect(sample.source).toBe('import');
    });
  });

  test('4. Export samples and verify CSV format', async () => {
    const csv = await sampleService.exportSamples(survey.id);
    
    expect(csv).toContain('respondentId');
    expect(csv).toContain('status');
    expect(csv).toContain('GOOD001');
    expect(csv).toContain('valid');
  });

  test('5. List all samples includes imported ones', async () => {
    const allSamples = await sampleService.findAll(survey.id);
    const importedSamples = allSamples.filter(s => s.source === 'import');
    
    expect(importedSamples.length).toBeGreaterThan(5);
  });

  test('6. Each imported sample has history record', async () => {
    const allSamples = await sampleService.findAll(survey.id);
    const importedSample = allSamples.find(s => s.respondentId === 'GOOD001');
    
    expect(importedSample).toBeDefined();
    
    if (importedSample) {
      const logs = await operationLogService.getLogs('sample', importedSample.id);
      const createLog = logs.find(log => log.operation === 'create');
      expect(createLog).toBeDefined();
    }
  });
});