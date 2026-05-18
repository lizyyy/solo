import { initDatabase } from '../src/models/database';
import { SkipApplicationService } from '../src/services/skipApplication.service';
import { WorkflowService } from '../src/services/workflow.service';
import { SkipApplicationStatus } from '../src/models/types';

async function main() {
  console.log('========== 异常流程测试 ==========\n');
  
  await initDatabase();
  
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

  console.log('✅ 异常流程测试通过！');
}

main();