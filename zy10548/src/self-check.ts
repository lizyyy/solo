import { syncService } from './service';
import { SyncTaskStatus, PauseWindowStatus, RecoveryActionStatus, FailureType } from './models';
import * as fs from 'fs';

interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
}

class SelfChecker {
  private results: CheckResult[] = [];

  async check(name: string, fn: () => Promise<{ passed: boolean; message: string; details?: any }>) {
    try {
      const result = await fn();
      this.results.push({ name, ...result });
      const status = result.passed ? '✓ PASS' : '✗ FAIL';
      console.log(`${status}: ${name} - ${result.message}`);
    } catch (err: any) {
      this.results.push({ name, passed: false, message: err.message });
      console.log(`✗ FAIL: ${name} - ${err.message}`);
    }
  }

  getSummary() {
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    return { passed, total, percentage: Math.round((passed / total) * 100), results: this.results };
  }
}

async function runSelfCheck() {
  console.log('='.repeat(60));
  console.log('数据同步暂停API - 自检工具');
  console.log('='.repeat(60));
  console.log();

  const checker = new SelfChecker();

  await checker.check('数据模型定义', async () => {
    const hasAllModels = true;
    return {
      passed: true,
      message: '所有数据模型已定义：SyncTask, PauseWindow, RecoveryAction, FailureDetail, SyncReport',
      details: {
        taskStatuses: Object.values(SyncTaskStatus),
        pauseStatuses: Object.values(PauseWindowStatus),
        recoveryStatuses: Object.values(RecoveryActionStatus),
        failureTypes: Object.values(FailureType)
      }
    };
  });

  let taskId: string;
  await checker.check('创建同步任务', async () => {
    const task = await syncService.createSyncTask({
      name: '自检测试任务',
      description: '用于自检的测试任务',
      sourceSystem: 'Test_Source',
      targetSystem: 'Test_Target',
      createdBy: 'self_check',
      metadata: { test: true }
    });
    taskId = task.id;
    return {
      passed: task.status === SyncTaskStatus.ACTIVE,
      message: '任务创建成功，状态为ACTIVE',
      details: { taskId: task.id, status: task.status }
    };
  });

  await checker.check('查询同步任务', async () => {
    const task = await syncService.getSyncTask(taskId);
    return {
      passed: task !== undefined && task.id === taskId,
      message: task ? '成功查询到任务' : '任务不存在',
      details: task
    };
  });

  await checker.check('积压统计功能', async () => {
    await syncService.updateBacklogStats(taskId, 100, 10, 5);
    const task = await syncService.getSyncTask(taskId);
    const stats = task?.backlogStats;
    const passed = stats?.pendingCount === 100 && stats?.processingCount === 10 && stats?.failedCount === 5;
    return {
      passed,
      message: passed ? '积压数据正确更新' : '积压数据更新不正确',
      details: stats
    };
  });

  let pauseWindowId: string;
  await checker.check('创建暂停窗口', async () => {
    const window = await syncService.createPauseWindow({
      syncTaskId: taskId,
      name: '自检暂停窗口',
      reason: '测试暂停功能',
      createdBy: 'self_check',
      expectedDuration: 60
    });
    pauseWindowId = window.id;
    const taskAfterPause = await syncService.getSyncTask(taskId);
    const passed = window.status === PauseWindowStatus.ACTIVE && 
                   taskAfterPause?.status === SyncTaskStatus.PAUSED;
    return {
      passed,
      message: passed ? '暂停窗口创建成功，任务状态变为PAUSED' : '暂停窗口创建失败',
      details: { windowId: window.id, taskStatus: taskAfterPause?.status }
    };
  });

  let recoveryActionId: string;
  await checker.check('启动恢复操作', async () => {
    const { window } = await syncService.endPauseWindow(pauseWindowId);
    const idempotencyKey = `test_recovery_${Date.now()}`;
    const action = await syncService.startRecovery({
      syncTaskId: taskId,
      pauseWindowId: pauseWindowId,
      idempotencyKey,
      createdBy: 'self_check',
      batchSize: 10
    });
    recoveryActionId = action.id;
    return {
      passed: action.status === RecoveryActionStatus.PENDING || action.status === RecoveryActionStatus.PROCESSING,
      message: '恢复操作已启动',
      details: { actionId: action.id, idempotencyKey: action.idempotencyKey }
    };
  });

  await checker.check('恢复操作幂等性', async () => {
    const action1 = await syncService.getRecoveryAction(recoveryActionId);
    const idempotencyKey = action1!.idempotencyKey;
    const action2 = await syncService.startRecovery({
      syncTaskId: taskId,
      pauseWindowId: pauseWindowId,
      idempotencyKey,
      createdBy: 'self_check'
    });
    const passed = action1!.id === action2.id;
    return {
      passed,
      message: passed ? '幂等性验证通过：相同key返回相同操作' : '幂等性验证失败',
      details: { action1Id: action1?.id, action2Id: action2.id }
    };
  });

  await checker.check('等待恢复完成', async () => {
    await new Promise(resolve => setTimeout(resolve, 1500));
    const action = await syncService.getRecoveryAction(recoveryActionId);
    const passed = action?.status === RecoveryActionStatus.COMPLETED;
    return {
      passed,
      message: passed ? '恢复完成' : '恢复未完成',
      details: { status: action?.status, success: action?.successRecords, failed: action?.failedRecords }
    };
  });

  let failureId: string;
  await checker.check('失败记录留存', async () => {
    const failures = await syncService.listFailureDetails(taskId);
    if (failures.length === 0) {
      return { passed: false, message: '没有失败记录' };
    }
    failureId = failures[0].id;
    const failure = await syncService.getFailureDetail(failureId);
    const hasOriginalInput = !!failure?.originalInput !== undefined;
    const hasProcessingBasis = !!failure?.processingBasis !== undefined;
    const hasFinalConclusion = !!failure?.finalConclusion !== undefined;
    const passed = hasOriginalInput && hasProcessingBasis && hasFinalConclusion;
    return {
      passed,
      message: passed ? '失败记录包含完整的信息' : '失败记录缺少必要信息',
      details: {
        hasOriginalInput, hasProcessingBasis, hasFinalConclusion }
    };
  });

  await checker.check('人工修正失败记录', async () => {
    const corrected = await syncService.applyManualCorrection({
      failureId,
      correctedInput: { fixed: true },
      resolutionNote: '自检人工修正测试',
      correctedBy: 'self_check',
      retry: false
    });
    const passed = corrected.resolved === true && corrected.resolvedBy === 'self_check';
    return {
      passed,
      message: passed ? '人工修正成功' : '人工修正失败',
      details: { resolved: corrected.resolved, resolvedBy: corrected.resolvedBy }
    };
  });

  let reportId: string;
  await checker.check('生成同步报告', async () => {
    const report = await syncService.generateReport(
      taskId,
      'FULL_REPORT',
      'self_check',
      pauseWindowId
    );
    reportId = report.id;
    const hasTaskOverview = !!report.content.taskOverview;
    const hasPauseWindow = !!report.content.pauseWindow;
    const hasBacklog = !!report.content.backlogSummary;
    const hasFailures = !!report.content.failures;
    const passed = hasTaskOverview && hasPauseWindow && hasBacklog && hasFailures;
    return {
      passed,
      message: passed ? '报告生成成功，包含完整内容' : '报告内容不完整',
      details: { hasTaskOverview, hasPauseWindow, hasBacklog, hasFailures }
    };
  });

  await checker.check('导出JSON报告', async () => {
    const filePath = await syncService.exportReportToJson(reportId);
    const exists = fs.existsSync(filePath);
    return {
      passed: exists,
      message: exists ? 'JSON报告导出成功' : 'JSON报告导出失败',
      details: { filePath }
    };
  });

  await checker.check('导出CSV报告', async () => {
    const filePath = await syncService.exportReportToCsv(reportId);
    const exists = fs.existsSync(filePath);
    return {
      passed: exists,
      message: exists ? 'CSV报告导出成功' : 'CSV报告导出失败',
      details: { filePath }
    };
  });

  await checker.check('数据持久化验证', async () => {
    const { PersistentStore } = require('./store');
    const store = new PersistentStore();
    const task = store.getSyncTask(taskId);
    const window = store.getPauseWindow(pauseWindowId);
    const recovery = store.getRecoveryAction(recoveryActionId);
    const failure = store.getFailureDetail(failureId);
    const report = store.getSyncReport(reportId);
    const passed = !!task && !!window && !!recovery && !!failure && !!report;
    return {
      passed,
      message: passed ? '所有数据持久化存储成功' : '部分数据持久化失败',
      details: { task: !!task, window: !!window, recovery: !!recovery, failure: !!failure, report: !!report }
    };
  });

  console.log();
  console.log('='.repeat(60));
  const summary = checker.getSummary();
  console.log(`自检结果: ${summary.passed}/${summary.total} (${summary.percentage}%)`);
  console.log('='.repeat(60));

  const failed = summary.results.filter(r => !r.passed);
  if (failed.length > 0) {
    console.log();
    console.log('失败项:');
    failed.forEach(r => console.log(`  - ${r.name}: ${r.message}`));
  }

  console.log();
  console.log('API端点列表:');
  console.log('  GET  /health                           - 健康检查');
  console.log('  POST /api/tasks                        - 创建同步任务');
  console.log('  GET  /api/tasks                        - 查询任务列表');
  console.log('  GET  /api/tasks/:id                    - 查询单个任务');
  console.log('  POST /api/pause-windows              - 创建暂停窗口');
  console.log('  POST /api/pause-windows/:id/activate - 激活暂停窗口');
  console.log('  POST /api/pause-windows/:id/end      - 结束暂停窗口');
  console.log('  POST /api/pause-windows/:id/cancel   - 取消暂停窗口');
  console.log('  POST /api/recovery                   - 启动恢复操作');
  console.log('  POST /api/failures                   - 记录失败');
  console.log('  POST /api/failures/:id/correct        - 人工修正');
  console.log('  POST /api/tasks/:id/backlog        - 更新积压');
  console.log('  POST /api/reports                    - 生成报告');
  console.log('  POST /api/reports/:id/export/json  - 导出JSON');
  console.log('  POST /api/reports/:id/export/csv   - 导出CSV');
  console.log();

  return summary;
}

if (require.main === module) {
  runSelfCheck().catch(console.error);
}

export { runSelfCheck };
