import sqlite3 from 'sqlite3';
import { initDatabase } from '../src/database/schema';
import { RecycleRepository } from '../src/database/repository';
import { RecycleService } from '../src/services/recycle.service';
import { RecycleAction, RecycleStatus } from '../src/types';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

async function runTest(name: string, testFn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await testFn();
    const duration = Date.now() - start;
    results.push({ name, passed: true, duration });
    console.log(`✓ ${name} (${duration}ms)`);
  } catch (err: any) {
    const duration = Date.now() - start;
    results.push({ name, passed: false, error: err.message, duration });
    console.log(`✗ ${name}: ${err.message} (${duration}ms)`);
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('试用功能回收API - 自检脚本启动');
  console.log('='.repeat(60));
  console.log('');

  const db = await initDatabase();
  const repository = new RecycleRepository(db);
  const service = new RecycleService(repository);

  await service.createSeedData();

  const features = await repository.getRecycleRecords({ pageSize: 100 });
  const allFeatures = await (repository as any).db.all('SELECT * FROM trial_features');

  if (allFeatures.length === 0) {
    throw new Error('No features created in seed data');
  }

  const feature1 = allFeatures[0];
  const feature2 = allFeatures[1] || allFeatures[0];

  console.log('测试数据准备完成:');
  console.log(`  - Feature 1: ${feature1.id} (${feature1.feature_name})`);
  console.log(`  - Feature 2: ${feature2.id} (${feature2.feature_name})`);
  console.log('');

  console.log('--- 1. 正常流程测试 ---');
  console.log('');

  let recordId: string;

  await runTest('创建回收记录', async () => {
    const record = await service.createRecycleRecord({
      tenantId: 'T001',
      featureId: feature1.id,
      trialEndDate: new Date(Date.now() - 15 * 86400000).toISOString().split('T')[0],
      recycleAction: RecycleAction.REMOVE_PERMISSION,
      createdBy: 'system',
      rawInput: JSON.stringify({ source: 'scheduled-job' })
    });
    recordId = record.id;
    if (!record.id) throw new Error('Record ID not returned');
    if (record.status !== RecycleStatus.PENDING_CONFIRM) throw new Error('Initial status incorrect');
  });

  await runTest('查询回收记录', async () => {
    const record = await service.getRecycleRecord(recordId);
    if (!record) throw new Error('Record not found');
    if (record.tenantId !== 'T001') throw new Error('Tenant ID mismatch');
  });

  await runTest('销售确认回收', async () => {
    await service.confirmSales(recordId, 'sales_a', '客户确认不再使用');
    const record = await service.getRecycleRecord(recordId);
    if (record?.status !== RecycleStatus.CONFIRMED) throw new Error('Status not updated to confirmed');
  });

  await runTest('开始执行回收', async () => {
    await service.startRecycle(recordId);
    const record = await service.getRecycleRecord(recordId);
    if (record?.status !== RecycleStatus.IN_PROGRESS) throw new Error('Status not updated to in_progress');
  });

  await runTest('完成回收', async () => {
    await service.completeRecycle(recordId, 'operator_a', '权限已成功移除');
    const record = await service.getRecycleRecord(recordId);
    if (record?.status !== RecycleStatus.COMPLETED) throw new Error('Status not updated to completed');
    if (!record.summary) throw new Error('Summary not generated');
  });

  console.log('');
  console.log('--- 2. 延期流程测试 ---');
  console.log('');

  let extendRecordId: string;

  await runTest('创建待延期的回收记录', async () => {
    const record = await service.createRecycleRecord({
      tenantId: 'T002',
      featureId: feature2.id,
      trialEndDate: new Date(Date.now() - 10 * 86400000).toISOString().split('T')[0],
      recycleAction: RecycleAction.DOWNGRADE_PLAN,
      createdBy: 'system'
    });
    extendRecordId = record.id;
  });

  await runTest('销售确认', async () => {
    await service.confirmSales(extendRecordId, 'sales_b', '确认后申请延期');
  });

  await runTest('申请延期30天', async () => {
    await service.applyExtension(extendRecordId, 30, '客户有续约意向', 'manager_a');
    const record = await service.getRecycleRecord(extendRecordId);
    if (record?.status !== RecycleStatus.EXTENDED) throw new Error('Status not updated to extended');
    if (record.extensionDays !== 30) throw new Error('Extension days not set correctly');
  });

  console.log('');
  console.log('--- 3. 脏数据测试 ---');
  console.log('');

  await runTest('拒绝空租户ID', async () => {
    try {
      await service.createRecycleRecord({
        tenantId: '',
        featureId: feature1.id,
        trialEndDate: '2024-01-01',
        recycleAction: RecycleAction.REMOVE_PERMISSION,
        createdBy: 'test'
      });
      throw new Error('Should have failed');
    } catch (e: any) {
      if (!e.message.includes('Validation')) throw new Error('Wrong error type: ' + e.message);
    }
  });

  await runTest('拒绝无效日期格式', async () => {
    try {
      await service.createRecycleRecord({
        tenantId: 'T001',
        featureId: feature1.id,
        trialEndDate: 'invalid-date',
        recycleAction: RecycleAction.REMOVE_PERMISSION,
        createdBy: 'test'
      });
      throw new Error('Should have failed');
    } catch (e: any) {
      if (!e.message.includes('Validation')) throw new Error('Wrong error type');
    }
  });

  await runTest('拒绝不存在的租户', async () => {
    try {
      await service.createRecycleRecord({
        tenantId: 'NONEXISTENT',
        featureId: feature1.id,
        trialEndDate: '2024-01-01',
        recycleAction: RecycleAction.REMOVE_PERMISSION,
        createdBy: 'test'
      });
      throw new Error('Should have failed');
    } catch (e: any) {
      if (!e.message.includes('not found')) throw new Error('Wrong error type');
    }
  });

  await runTest('拒绝无效的回收动作', async () => {
    try {
      await service.createRecycleRecord({
        tenantId: 'T001',
        featureId: feature1.id,
        trialEndDate: '2024-01-01',
        recycleAction: 'invalid_action' as any,
        createdBy: 'test'
      });
      throw new Error('Should have failed');
    } catch (e: any) {
      if (!e.message.includes('Validation')) throw new Error('Wrong error type');
    }
  });

  await runTest('拒绝超期的延期天数', async () => {
    try {
      await service.applyExtension(extendRecordId, 365, '太长', 'test');
      throw new Error('Should have failed');
    } catch (e: any) {
      if (!e.message.includes('between 1 and 180')) throw new Error('Wrong error type');
    }
  });

  console.log('');
  console.log('--- 4. 重复请求测试 ---');
  console.log('');

  let dupTestRecordId: string;

  await runTest('创建第一个回收记录', async () => {
    const record = await service.createRecycleRecord({
      tenantId: 'T003',
      featureId: allFeatures[2]?.id || feature1.id,
      trialEndDate: '2024-01-15',
      recycleAction: RecycleAction.SUSPEND_ACCOUNT,
      createdBy: 'test'
    });
    dupTestRecordId = record.id;
  });

  await runTest('拒绝重复创建（同一功能）', async () => {
    try {
      await service.createRecycleRecord({
        tenantId: 'T003',
        featureId: allFeatures[2]?.id || feature1.id,
        trialEndDate: '2024-01-15',
        recycleAction: RecycleAction.SUSPEND_ACCOUNT,
        createdBy: 'test'
      });
      throw new Error('Should have failed');
    } catch (e: any) {
      if (!e.message.includes('already exists')) throw new Error('Wrong error type: ' + e.message);
    }
  });

  await runTest('重复发送提醒（幂等）', async () => {
    await service.sendReminder(dupTestRecordId);
    await service.sendReminder(dupTestRecordId);
    const record = await service.getRecycleRecord(dupTestRecordId);
    if (record?.reminderCount !== 2) throw new Error('Reminder count should be 2');
  });

  console.log('');
  console.log('--- 5. 异常处理测试 ---');
  console.log('');

  let exceptionRecordId: string;

  await runTest('创建异常测试记录', async () => {
    const record = await service.createRecycleRecord({
      tenantId: 'T004',
      featureId: allFeatures[3]?.id || feature1.id,
      trialEndDate: '2024-02-01',
      recycleAction: RecycleAction.NOTIFY_ONLY,
      createdBy: 'test'
    });
    exceptionRecordId = record.id;
  });

  await runTest('记录异常并保留原始输入', async () => {
    await service.handleException(
      exceptionRecordId,
      'API_ERROR',
      '调用用户中心API失败: 500 Internal Server Error',
      JSON.stringify({ userId: 'u123', action: 'remove_perm', timestamp: Date.now() }),
      JSON.stringify({ request: { method: 'POST', url: '/api/user' }, response: { status: 500 } })
    );
    const record = await service.getRecycleRecord(exceptionRecordId);
    if (record?.status !== RecycleStatus.EXCEPTION) throw new Error('Status not updated to exception');
    const exceptions = await service.getExceptions(exceptionRecordId);
    if (exceptions.length === 0) throw new Error('Exception not recorded');
    if (!exceptions[0].rawInput) throw new Error('Raw input not preserved');
    if (!exceptions[0].processingEvidence) throw new Error('Processing evidence not preserved');
  });

  await runTest('解决异常', async () => {
    const exceptions = await service.getExceptions(exceptionRecordId);
    await service.resolveException(exceptions[0].id, 'operator_a', 'API服务已恢复，手动完成回收');
  });

  console.log('');
  console.log('--- 6. 人工修正测试 ---');
  console.log('');

  let manualRecordId: string;

  await runTest('创建人工修正测试记录', async () => {
    const record = await service.createRecycleRecord({
      tenantId: 'T005',
      featureId: allFeatures[4]?.id || feature1.id,
      trialEndDate: '2024-02-15',
      recycleAction: RecycleAction.CUSTOM,
      createdBy: 'test'
    });
    manualRecordId = record.id;
  });

  await runTest('人工修正状态', async () => {
    await service.manualUpdate(
      manualRecordId,
      { status: RecycleStatus.CONFIRMED, salesConfirmStatus: 'confirmed' },
      'admin'
    );
    const record = await service.getRecycleRecord(manualRecordId);
    if (record?.status !== RecycleStatus.CONFIRMED) throw new Error('Manual status update failed');
  });

  await runTest('人工修正到期日', async () => {
    const newDate = '2024-03-01';
    await service.manualUpdate(
      manualRecordId,
      { trialEndDate: newDate },
      'admin'
    );
    const record = await service.getRecycleRecord(manualRecordId);
    if (record?.trialEndDate !== newDate) throw new Error('Manual date update failed');
  });

  console.log('');
  console.log('--- 7. 汇总和导出测试 ---');
  console.log('');

  await runTest('获取汇总统计', async () => {
    const summary = await service.getSummary();
    if (summary.totalRecords === 0) throw new Error('Summary should have records');
    console.log(`    总记录: ${summary.totalRecords}, 待确认: ${summary.pendingConfirm}, 已完成: ${summary.completed}, 延期: ${summary.extended}`);
  });

  await runTest('分页查询记录', async () => {
    const result = await service.queryRecycleRecords({ page: 1, pageSize: 5 });
    if (result.total === 0) throw new Error('Query should return results');
  });

  await runTest('按状态筛选查询', async () => {
    const result = await service.queryRecycleRecords({ status: RecycleStatus.COMPLETED, page: 1, pageSize: 10 });
    if (result.records.some(r => r.status !== RecycleStatus.COMPLETED)) {
      throw new Error('Filter by status not working');
    }
  });

  await runTest('导出所有记录', async () => {
    const records = await service.exportRecords();
    if (records.length === 0) throw new Error('Export should return records');
  });

  console.log('');
  console.log('='.repeat(60));
  console.log('测试结果汇总');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalTime = results.reduce((sum, r) => sum + r.duration, 0);

  console.log('');
  console.log(`通过: ${passed} / ${results.length}`);
  console.log(`失败: ${failed}`);
  console.log(`总耗时: ${totalTime}ms`);
  console.log('');

  if (failed > 0) {
    console.log('失败的测试:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
    console.log('');
    process.exit(1);
  } else {
    console.log('🎉 所有测试通过!');
    console.log('');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('测试执行失败:', err);
  process.exit(1);
});
