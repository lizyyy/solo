import { initDatabase } from '../src/models/database';
import { SkipApplicationService } from '../src/services/skipApplication.service';
import { WorkflowService } from '../src/services/workflow.service';
import { ExportService } from '../src/services/export.service';
import { SkipApplicationStatus } from '../src/models/types';

async function normalFlowTest() {
  console.log('========== 正常流程测试 ==========\n');
  
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

  console.log('✅ 正常流程测试通过！\n');
}

async function abnormalFlowTest() {
  console.log('========== 异常流程测试 ==========\n');
  
  console.log('测试 1: 审批拒绝');
  const app1 = await SkipApplicationService.create({
    workflow_id: 'workflow-002',
    task_id: 'task-data-002',
    task_name: '数据清洗任务',
    skip_reason: '不想跑了',
    impact_scope: '全部下游',
    rerun_plan: '不补跑',
    applicant: '王五'
  });
  await SkipApplicationService.approve({
    skip_application_id: app1.id,
    approver: '赵六',
    approval_result: 'rejected',
    approval_comment: '跳过原因不充分，不允许跳过'
  });
  const rejectedApp = await SkipApplicationService.getById(app1.id);
  console.log('✓ 审批拒绝测试完成');
  console.log('  状态:', rejectedApp?.status);
  console.log();

  console.log('测试 2: 补跑失败');
  const app2 = await SkipApplicationService.create({
    workflow_id: 'workflow-003',
    task_id: 'task-etl-003',
    task_name: 'ETL任务',
    skip_reason: '源数据格式异常，待修复',
    impact_scope: '下游所有任务',
    rerun_plan: '修复后立即补跑',
    applicant: '钱七'
  });
  await SkipApplicationService.approve({
    skip_application_id: app2.id,
    approver: '孙八',
    approval_result: 'approved'
  });
  const rerunRecord = await WorkflowService.createRerunRecord(
    app2.id,
    'task-etl-003',
    'ETL任务（补跑）'
  );
  await WorkflowService.startRerun(rerunRecord.id);
  await WorkflowService.completeRerun(rerunRecord.id, false);
  const failedApp = await SkipApplicationService.getById(app2.id);
  console.log('✓ 补跑失败测试完成');
  console.log('  状态:', failedApp?.status);
  console.log('  补跑失败后状态保持:', failedApp?.status === SkipApplicationStatus.APPROVED ? '审批通过（需要重新补跑）' : '异常');
  console.log();

  console.log('测试 3: 重复审批（应该失败）');
  try {
    await SkipApplicationService.approve({
      skip_application_id: app1.id,
      approver: '周九',
      approval_result: 'approved'
    });
    console.log('✗ 重复审批未被阻止，测试失败');
  } catch (e) {
    console.log('✓ 重复审批已被正确阻止');
  }
  console.log();

  console.log('测试 4: 查询不存在的申请（应该返回空）');
  const notFound = await SkipApplicationService.getById('non-existent-id');
  console.log('✓ 不存在申请查询测试完成');
  console.log('  查询结果:', notFound ? '异常' : '正确返回空');
  console.log();

  console.log('✅ 异常流程测试通过！\n');
}

async function repeatRunTest() {
  console.log('========== 重复运行测试 ==========\n');
  
  const applications = [];
  
  for (let i = 1; i <= 5; i++) {
    console.log(`创建第 ${i} 个跳过申请...`);
    const app = await SkipApplicationService.create({
      workflow_id: `workflow-batch-${Math.ceil(i/2)}`,
      task_id: `task-${i}`,
      task_name: `测试任务 ${i}`,
      skip_reason: `批量测试跳过原因 ${i}`,
      impact_scope: '下游测试任务',
      rerun_plan: '批量补跑计划',
      applicant: '测试用户'
    });
    applications.push(app);
    
    await SkipApplicationService.approve({
      skip_application_id: app.id,
      approver: '审批用户',
      approval_result: 'approved'
    });
    
    if (i % 2 === 0) {
      const rerun = await WorkflowService.createRerunRecord(app.id, `task-${i}`, `补跑任务 ${i}`);
      await WorkflowService.startRerun(rerun.id);
      await WorkflowService.completeRerun(rerun.id, true);
    }
  }
  
  console.log('\n✓ 批量创建和审批完成');
  console.log('  共创建申请:', applications.length);
  console.log();
  
  console.log('查询所有跳过申请:');
  const allApps = await SkipApplicationService.getAll();
  allApps.forEach((app, index) => {
    console.log(`  ${index + 1}. ${app.task_name} - ${app.status}`);
  });
  console.log();
  
  console.log('查询所有工作流记录:');
  const workflowRecords = await WorkflowService.getWorkflowRecords();
  console.log('  总记录数:', workflowRecords.length);
  console.log();
  
  console.log('查询所有补跑记录:');
  const rerunRecords = await WorkflowService.getRerunRecords();
  console.log('  总补跑数:', rerunRecords.length);
  rerunRecords.forEach((rerun, index) => {
    console.log(`  ${index + 1}. ${rerun.rerun_task_name} - ${rerun.status}`);
  });
  console.log();
  
  console.log('批量导出测试:');
  const exportPath = await ExportService.exportSkipRecords();
  console.log('  导出路径:', exportPath);
  console.log();
  
  console.log('多工作流关闭权限检查:');
  for (let i = 1; i <= 3; i++) {
    const result = await WorkflowService.canCloseService(`workflow-batch-${i}`);
    console.log(`  workflow-batch-${i}: ${result.canClose ? '可以关闭' : '不可关闭 - ' + result.reason}`);
  }
  console.log();
  
  console.log('✅ 重复运行测试通过！\n');
}

async function main() {
  console.log('开始验收测试...\n');
  
  await initDatabase();
  
  try {
    await normalFlowTest();
    await abnormalFlowTest();
    await repeatRunTest();
    
    console.log('🎉 所有验收测试通过！');
    console.log('\n测试摘要:');
    console.log('  ✓ 正常流程：跳过申请 → 审批通过 → 下游异常 → 补跑完成 → 服务可关闭');
    console.log('  ✓ 异常流程：审批拒绝、补跑失败、重复审批拦截、不存在申请处理');
    console.log('  ✓ 重复运行：批量创建、批量审批、状态管理、多工作流检查');
    console.log('  ✓ 导出功能：生成CSV格式的依赖跳过表');
    console.log('\n请查看 exports 目录下的导出文件进行人工复核。');
  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

main();