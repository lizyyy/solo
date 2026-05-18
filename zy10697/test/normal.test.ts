import { initDatabase } from '../src/models/database';
import { SkipApplicationService } from '../src/services/skipApplication.service';
import { WorkflowService } from '../src/services/workflow.service';
import { ExportService } from '../src/services/export.service';

async function main() {
  console.log('========== 正常流程测试 ==========\n');
  
  await initDatabase();
  
  console.log('阶段 1: 创建跳过申请');
  const application = await SkipApplicationService.create({
    workflow_id: 'workflow-001',
    task_id: 'task-dependency-001',
    task_name: '上游数据同步任务',
    skip_reason: '上游数据源临时维护，预计2小时后恢复',
    impact_scope: '下游报表生成、数据统计、用户画像三个任务',
    rerun_plan: '待上游恢复后立即补跑，预计耗时30分钟',
    applicant: '张三'
  });
  console.log('✓ 跳过申请创建成功');
  console.log('  申请ID:', application.id);
  console.log('  当前状态:', application.status);
  console.log();

  console.log('阶段 2: 审批通过');
  await SkipApplicationService.approve({
    skip_application_id: application.id,
    approver: '李四',
    approval_result: 'approved',
    approval_comment: '同意跳过，请及时补跑'
  });
  const approvedApp = await SkipApplicationService.getById(application.id);
  console.log('✓ 审批通过');
  console.log('  当前状态:', approvedApp?.status);
  console.log();

  console.log('阶段 3: 执行下游任务，检测到数据不完整');
  const workflowRecord = await WorkflowService.executeTask({
    workflow_id: 'workflow-001',
    task_id: 'task-report-001',
    task_name: '报表生成任务',
    downstream_tasks: ['task-email-001']
  }, application.id);
  console.log('✓ 下游任务执行完成');
  console.log('  数据完整性:', workflowRecord.data_completeness);
  console.log('  是否跳过:', workflowRecord.is_skipped ? '是' : '否');
  console.log();

  console.log('阶段 4: 上报下游异常');
  await WorkflowService.reportDownstreamException({
    workflow_record_id: workflowRecord.id,
    skip_application_id: application.id
  });
  const exceptionApp = await SkipApplicationService.getById(application.id);
  console.log('✓ 下游异常已上报');
  console.log('  当前状态:', exceptionApp?.status);
  console.log();

  console.log('阶段 5: 检查服务关闭权限（应该被阻止）');
  const canCloseResult = await WorkflowService.canCloseService('workflow-001');
  console.log('✓ 服务关闭检查完成');
  console.log('  是否允许关闭:', canCloseResult.canClose ? '是' : '否');
  console.log('  原因:', canCloseResult.reason);
  console.log();

  console.log('阶段 6: 创建并完成补跑');
  const rerunRecord = await WorkflowService.createRerunRecord(
    application.id,
    'task-dependency-001',
    '上游数据同步任务（补跑）'
  );
  await WorkflowService.startRerun(rerunRecord.id);
  await WorkflowService.completeRerun(rerunRecord.id, true);
  const completedApp = await SkipApplicationService.getById(application.id);
  console.log('✓ 补跑完成');
  console.log('  当前状态:', completedApp?.status);
  console.log();

  console.log('阶段 7: 再次检查服务关闭权限（应该允许）');
  const canCloseResult2 = await WorkflowService.canCloseService('workflow-001');
  console.log('✓ 服务关闭检查完成');
  console.log('  是否允许关闭:', canCloseResult2.canClose ? '是' : '否');
  console.log();

  console.log('阶段 8: 导出依赖跳过表');
  const exportPath = await ExportService.exportSkipRecords();
  console.log('✓ 导出完成');
  console.log('  文件路径:', exportPath);
  console.log();

  console.log('✅ 正常流程测试通过！');
  console.log('\n请查看 exports 目录下的导出文件进行人工复核。');
}

main();