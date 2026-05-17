import 'reflect-metadata';
import { AppDataSource } from '../app';
import { SurveyStatus } from '../models/Survey';
import { QuotaStatus } from '../models/QuotaGroup';
import { SampleStatus, SampleSource } from '../models/Sample';
import { ResampleStatus } from '../models/ResampleReason';
import { surveyService } from '../services/survey';
import { quotaService } from '../services/quota';
import { sampleService } from '../services/sample';
import { resampleService } from '../services/resample';

async function seed() {
  try {
    await AppDataSource.initialize();
    console.log('Database connected');

    console.log('Creating surveys...');
    const survey1 = await surveyService.create({
      title: '用户满意度调研 2024',
      description: '针对产品使用体验的满意度调研',
      status: SurveyStatus.COLLECTING,
      targetSampleSize: 100,
      currentSampleSize: 0,
    }, 'system');

    const survey2 = await surveyService.create({
      title: '市场需求调研',
      description: '新品上市前的市场需求分析',
      status: SurveyStatus.QUOTA_FULL,
      targetSampleSize: 50,
      currentSampleSize: 50,
    }, 'system');

    console.log('Creating quota groups...');
    const quota1 = await quotaService.create({
      surveyId: survey1.id,
      name: '18-25岁 男性',
      conditions: { age: '18-25', gender: 'male' },
      status: QuotaStatus.COLLECTING,
      targetCount: 30,
      currentCount: 25,
    }, 'system');

    const quota2 = await quotaService.create({
      surveyId: survey1.id,
      name: '18-25岁 女性',
      conditions: { age: '18-25', gender: 'female' },
      status: QuotaStatus.QUOTA_FULL,
      targetCount: 30,
      currentCount: 30,
    }, 'system');

    const quota3 = await quotaService.create({
      surveyId: survey1.id,
      name: '26-35岁 通用',
      conditions: { age: '26-35' },
      status: QuotaStatus.COLLECTING,
      targetCount: 40,
      currentCount: 10,
    }, 'system');

    const quota4 = await quotaService.create({
      surveyId: survey2.id,
      name: '一线城市用户',
      conditions: { city: 'tier1' },
      status: QuotaStatus.QUOTA_FULL,
      targetCount: 50,
      currentCount: 50,
    }, 'system');

    console.log('Creating samples...');
    const samples = [];
    for (let i = 1; i <= 25; i++) {
      samples.push(await sampleService.create({
        surveyId: survey1.id,
        quotaGroupId: quota1.id,
        respondentId: `R${String(i).padStart(4, '0')}`,
        status: SampleStatus.VALID,
        source: SampleSource.ONLINE,
        data: { name: `用户${i}`, age: 20 + i % 5, gender: 'male' },
      }, 'system'));
    }

    for (let i = 26; i <= 55; i++) {
      samples.push(await sampleService.create({
        surveyId: survey1.id,
        quotaGroupId: quota2.id,
        respondentId: `R${String(i).padStart(4, '0')}`,
        status: SampleStatus.VALID,
        source: SampleSource.ONLINE,
        data: { name: `用户${i}`, age: 20 + i % 5, gender: 'female' },
      }, 'system'));
    }

    for (let i = 56; i <= 65; i++) {
      samples.push(await sampleService.create({
        surveyId: survey1.id,
        quotaGroupId: quota3.id,
        respondentId: `R${String(i).padStart(4, '0')}`,
        status: SampleStatus.VALID,
        source: SampleSource.ONLINE,
        data: { name: `用户${i}`, age: 28 + i % 7 },
      }, 'system'));
    }

    for (let i = 66; i <= 115; i++) {
      samples.push(await sampleService.create({
        surveyId: survey2.id,
        quotaGroupId: quota4.id,
        respondentId: `R${String(i).padStart(4, '0')}`,
        status: SampleStatus.VALID,
        source: SampleSource.ONLINE,
        data: { name: `用户${i}`, city: 'Beijing' },
      }, 'system'));
    }

    console.log('Creating invalid sample for conflict test...');
    const conflictSample = await sampleService.create({
      surveyId: survey1.id,
      quotaGroupId: quota2.id,
      respondentId: 'R9999',
      status: SampleStatus.VALID,
      source: SampleSource.RESAMPLE,
      data: { name: '冲突测试用户', age: 22, gender: 'female' },
    }, 'system');

    await sampleService.markAsInvalid(
      conflictSample.id,
      '回答前后矛盾，逻辑不一致',
      'auditor_zhang',
      '该样本经过多人复核，确认存在严重逻辑冲突，决定剔除'
    );

    console.log('Creating resample reasons...');
    await resampleService.create({
      surveyId: survey1.id,
      quotaGroupId: quota2.id,
      reason: '因无效样本剔除，需要补充样本',
      requestedCount: 5,
      status: ResampleStatus.PENDING,
      requestedBy: 'project_manager',
      remark: 'quota2组因为无效样本，目标数还差5个',
    }, 'project_manager');

    await resampleService.create({
      surveyId: survey2.id,
      quotaGroupId: quota4.id,
      reason: '样本代表性不足，需要额外补充',
      requestedCount: 10,
      status: ResampleStatus.APPROVED,
      approvedCount: 8,
      requestedBy: 'research_lead',
      approvedBy: 'director_wang',
      remark: '一线城市样本覆盖还不够，批准补充8个',
    }, 'research_lead');

    console.log('Seed data created successfully!');
    console.log(`Created 2 surveys, 4 quota groups, ${samples.length + 1} samples, 2 resample reasons`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
}

seed();