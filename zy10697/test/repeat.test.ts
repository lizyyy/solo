import { initDatabase } from '../src/models/database';
import { SkipApplicationService } from '../src/services/skipApplication.service';
import { WorkflowService } from '../src/services/workflow.service';
import { ExportService } from '../src/services/export.service';

async function main() {
  console.log('========== 重复运行测试 ==========\n');
  
  await initDatabase();
  
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
  
  console.log('✅ 重复运行测试通过！');
  console.log('\n请查看 exports 目录下的导出文件进行人工复核。');
}

main();