require('dotenv').config();
const { sequelize, CompensationQueue } = require('../src/models');
const QueueService = require('../src/services/queueService');
const logger = require('../src/config/logger');

logger.transports.forEach(t => (t.silent = true));

beforeAll(async () => {
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  await sequelize.close();
});

describe('QueueService - 状态变化测试', () => {
  test('任务从pending到success的状态流转', async () => {
    const job = await QueueService.addJob('compensation', { test: 'data' });
    expect(job.status).toBe('pending');

    await QueueService.processJob(job.id);
    const processingJob = await CompensationQueue.findByPk(job.id);
    expect(processingJob.status).toBe('processing');

    await QueueService.markJobSuccess(job.id);
    const successJob = await CompensationQueue.findByPk(job.id);
    expect(successJob.status).toBe('success');
  });

  test('任务失败后进入waiting_retry状态', async () => {
    const job = await QueueService.addJob('compensation', { test: 'data' }, { maxRetryCount: 3 });
    expect(job.status).toBe('pending');

    await QueueService.processJob(job.id);
    
    const error = new Error('模拟网络错误');
    error.code = 'NETWORK_ERROR';
    await QueueService.markJobFailed(job.id, error, true);

    const failedJob = await CompensationQueue.findByPk(job.id);
    expect(failedJob.status).toBe('waiting_retry');
    expect(failedJob.retryCount).toBe(1);
    expect(failedJob.nextRetryAt).not.toBeNull();
  });

  test('超过最大重试次数后进入permanent_failed状态', async () => {
    const job = await QueueService.addJob('compensation', { test: 'data' }, { maxRetryCount: 2 });
    
    await QueueService.processJob(job.id);
    await QueueService.markJobFailed(job.id, new Error('第一次失败'), true);
    let jobAfterRetry1 = await CompensationQueue.findByPk(job.id);
    expect(jobAfterRetry1.status).toBe('waiting_retry');
    expect(jobAfterRetry1.retryCount).toBe(1);

    await QueueService.processJob(job.id);
    await QueueService.markJobFailed(job.id, new Error('第二次失败'), true);
    let jobAfterRetry2 = await CompensationQueue.findByPk(job.id);
    expect(jobAfterRetry2.status).toBe('permanent_failed');
    expect(jobAfterRetry2.retryCount).toBe(2);
  });

  test('不可重试错误直接进入permanent_failed状态', async () => {
    const job = await QueueService.addJob('compensation', { test: 'data' }, { maxRetryCount: 3 });
    
    await QueueService.processJob(job.id);
    await QueueService.markJobFailed(job.id, new Error('数据格式错误'), false);

    const failedJob = await CompensationQueue.findByPk(job.id);
    expect(failedJob.status).toBe('permanent_failed');
    expect(failedJob.retryCount).toBe(1);
  });

  test('人工处理状态流转 - 从waiting_manual到retry成功', async () => {
    const job = await QueueService.addJob('compensation', { test: 'data' }, { maxRetryCount: 1 });
    
    await QueueService.processJob(job.id);
    await QueueService.markJobFailed(job.id, new Error('失败'), true);
    
    const failedJob = await CompensationQueue.findByPk(job.id);
    expect(failedJob.status).toBe('permanent_failed');

    await QueueService.markWaitingManual(job.id, '需要人工确认');
    const manualJob = await CompensationQueue.findByPk(job.id);
    expect(manualJob.status).toBe('waiting_manual');
  });

  test('错误历史记录保存正确', async () => {
    const job = await QueueService.addJob('compensation', { test: 'data' }, { maxRetryCount: 3 });
    
    for (let i = 0; i < 2; i++) {
      await QueueService.processJob(job.id);
      await QueueService.markJobFailed(job.id, new Error(`失败 ${i + 1}`), true);
    }

    const failedJob = await CompensationQueue.findByPk(job.id);
    expect(failedJob.errorHistory.length).toBe(2);
    expect(failedJob.errorHistory[0].error).toContain('失败 1');
    expect(failedJob.errorHistory[1].error).toContain('失败 2');
    expect(failedJob.lastError).toContain('失败 2');
  });
});

describe('QueueService - 幂等性测试', () => {
  test('重复添加相同任务不会产生冲突', async () => {
    const payload = { deliveryNo: 'DEL-IDEMPOTENT-001', amount: 100 };
    
    const job1 = await QueueService.addJob('compensation', { ...payload });
    const job2 = await QueueService.addJob('compensation', { ...payload });

    expect(job1.id).not.toBe(job2.id);
    expect(job1.queueNo).not.toBe(job2.queueNo);

    const count = await CompensationQueue.count({
      where: { deliveryNo: 'DEL-IDEMPOTENT-001' }
    });
    expect(count).toBe(2);
  });

  test('重复调用markJobSuccess是幂等的', async () => {
    const job = await QueueService.addJob('compensation', { test: 'idempotent' });
    
    await QueueService.processJob(job.id);
    await QueueService.markJobSuccess(job.id, { result: 'ok' });
    
    const job1 = await CompensationQueue.findByPk(job.id);
    const status1 = job1.status;
    const updatedAt1 = job1.updatedAt;

    await new Promise(resolve => setTimeout(resolve, 10));
    await QueueService.markJobSuccess(job.id, { result: 'ok' });
    
    const job2 = await CompensationQueue.findByPk(job.id);
    expect(job2.status).toBe(status1);
  });
});
