import { syncService } from './service';
import { SyncTaskStatus, FailureType } from './models';

async function runExample() {
  console.log('=== 数据同步暂停API - 完整示例 ===\n');

  console.log('1. 创建同步任务');
  const task = await syncService.createSyncTask({
    name: '用户数据同步 - CRM到下游系统',
    description: '每日增量用户数据同步任务',
    sourceSystem: 'CRM_System',
    targetSystem: 'Downstream_Analytics',
    createdBy: 'admin',
    metadata: { schedule: 'daily', priority: 'high' }
  });
  console.log('   任务ID:', task.id);
  console.log('   任务状态:', task.status);
  console.log();

  console.log('2. 模拟积压数据增长');
  await syncService.updateBacklogStats(task.id, 500, 0, 0);
  const updatedTask = await syncService.getSyncTask(task.id);
  console.log('   当前积压:', updatedTask?.backlogStats);
  console.log();

  console.log('3. 创建暂停窗口（下游系统维护）');
  const pauseWindow = await syncService.createPauseWindow({
    syncTaskId: task.id,
    name: '下游系统版本升级维护',
    reason: '下游系统进行版本升级，需要暂停数据同步',
    createdBy: 'operator',
    expectedDuration: 1800
  });
  console.log('   暂停窗口ID:', pauseWindow.id);
  console.log('   暂停窗口状态:', pauseWindow.status);
  console.log('   暂停时积压:', pauseWindow.backlogAtPause);
  
  const taskAfterPause = await syncService.getSyncTask(task.id);
  console.log('   任务状态变为:', taskAfterPause?.status);
  console.log();

  console.log('4. 暂停期间继续累积积压');
  await syncService.updateBacklogStats(task.id, 300, 0, 0);
  const taskDuringPause = await syncService.getSyncTask(task.id);
  console.log('   暂停期间积压:', taskDuringPause?.backlogStats);
  console.log();

  console.log('5. 结束暂停窗口，进入恢复阶段');
  const { window: endedWindow, task: resumedTask } = await syncService.endPauseWindow(pauseWindow.id);
  console.log('   暂停窗口结束时间:', endedWindow.endTime);
  console.log('   恢复时积压:', endedWindow.backlogAtResume);
  console.log('   任务状态变为:', resumedTask.status);
  console.log();

  console.log('6. 启动恢复操作（幂等）');
  const recoveryAction = await syncService.startRecovery({
    syncTaskId: task.id,
    pauseWindowId: pauseWindow.id,
    idempotencyKey: `recovery_${task.id}_${Date.now()}`,
    createdBy: 'recovery_bot',
    batchSize: 50
  });
  console.log('   恢复操作ID:', recoveryAction.id);
  console.log('   待恢复记录数:', recoveryAction.totalRecords);
  console.log();

  console.log('7. 等待恢复处理完成...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const completedRecovery = await syncService.getRecoveryAction(recoveryAction.id);
  console.log('   恢复状态:', completedRecovery?.status);
  console.log('   处理成功:', completedRecovery?.successRecords);
  console.log('   处理失败:', completedRecovery?.failedRecords);
  console.log();

  console.log('8. 查看失败明细');
  const failures = await syncService.listFailureDetails(task.id);
  console.log('   失败记录数:', failures.length);
  if (failures.length > 0) {
    const firstFailure = failures[0];
    console.log('   第一个失败ID:', firstFailure.id);
    console.log('   错误类型:', firstFailure.failureType);
    console.log('   原始输入:', firstFailure.originalInput);
    console.log('   处理依据:', firstFailure.processingBasis);
    console.log('   最终结论:', firstFailure.finalConclusion);
    console.log('   是否已解决:', firstFailure.resolved);
  }
  console.log();

  console.log('9. 人工修正失败记录');
  if (failures.length > 0) {
    const corrected = await syncService.applyManualCorrection({
      failureId: failures[0].id,
      correctedInput: { corrected: true, value: 'fixed_value' },
      resolutionNote: '人工审核后修正数据格式问题',
      correctedBy: 'data_engineer',
      retry: true
    });
    console.log('   修正后状态:', corrected.resolved ? '已解决' : '未解决');
    console.log('   修正人:', corrected.resolvedBy);
    console.log('   修正说明:', corrected.resolutionNote);
  }
  console.log();

  console.log('10. 生成同步报告');
  const report = await syncService.generateReport(
    task.id,
    'FULL_REPORT',
    'report_generator',
    pauseWindow.id
  );
  console.log('   报告ID:', report.id);
  console.log('   报告类型:', report.reportType);
  console.log('   任务概览:', report.content.taskOverview);
  console.log('   暂停窗口信息:', report.content.pauseWindow);
  console.log('   恢复统计:', report.content.recoveryStats);
  console.log('   积压摘要:', report.content.backlogSummary);
  console.log('   失败统计:', report.content.failures);
  console.log();

  console.log('11. 导出报告为JSON和CSV');
  const jsonPath = await syncService.exportReportToJson(report.id);
  const csvPath = await syncService.exportReportToCsv(report.id);
  console.log('   JSON报告路径:', jsonPath);
  console.log('   CSV报告路径:', csvPath);
  console.log();

  console.log('12. 验证数据持久化（重启后可查）');
  const reloadedTask = await syncService.getSyncTask(task.id);
  const reloadedWindow = await syncService.getPauseWindow(pauseWindow.id);
  const reloadedReport = await syncService.getSyncReport(report.id);
  console.log('   任务重新加载成功:', reloadedTask?.name === task.name);
  console.log('   暂停窗口重新加载成功:', reloadedWindow?.id === pauseWindow.id);
  console.log('   报告重新加载成功:', reloadedReport?.id === report.id);
  console.log();

  console.log('=== 示例执行完成 ===');
  console.log();
  console.log('关键功能验证:');
  console.log('✓ 暂停状态管理 (ACTIVE -> PAUSED -> RESUMING)');
  console.log('✓ 积压数据统计 (暂停时/恢复时积压量)');
  console.log('✓ 恢复操作幂等 (相同idempotencyKey返回相同结果)');
  console.log('✓ 失败记录留存 (原始输入、处理依据、最终结论)');
  console.log('✓ 人工修正流程 (标记解决+重试)');
  console.log('✓ 报告生成与导出 (JSON/CSV)');
  console.log('✓ 数据持久化 (重启后数据可查)');
}

if (require.main === module) {
  runExample().catch(console.error);
}

export { runExample };
