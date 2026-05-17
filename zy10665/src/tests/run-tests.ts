import assert from 'assert';
import { createProject } from '../services/projectService';
import { createMilestone, getMilestoneById, updateMilestoneStatus } from '../services/milestoneService';
import { createExtensionRequest, reviewExtensionRequest, validateExtensionRequest } from '../services/extensionService';
import { getHistoryByEntity, getAllHistory } from '../services/historyService';
import { closeDB } from '../db';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

async function runTest(name: string, testFn: () => Promise<void>) {
  try {
    await testFn();
    results.push({ name, passed: true });
    console.log(`✓ ${name}`);
  } catch (error) {
    results.push({ name, passed: false, error: (error as Error).message });
    console.log(`✗ ${name}: ${(error as Error).message}`);
  }
}

async function main() {
  console.log('=== 开始运行测试 ===\n');
  
  await runTest('1. 完整流转: 创建项目 -> 里程碑 -> 延期申请 -> 审核通过', async () => {
    const projectId = await createProject({ name: '测试项目A', code: 'TEST-001' }, 'tester');
    assert.ok(projectId, '项目ID不应为空');
    
    const milestoneId = await createMilestone({
      project_id: projectId,
      name: '测试里程碑',
      planned_date: '2024-12-31',
      created_by: 'tester'
    });
    assert.ok(milestoneId, '里程碑ID不应为空');
    
    const extResult = await createExtensionRequest({
      milestone_id: milestoneId,
      requested_by: 'tester',
      requested_date: '2025-01-31',
      reason: '测试延期原因，这是一个完整的测试',
      impact_scope: '测试影响范围，覆盖多个子系统'
    });
    assert.ok(extResult.success, '延期申请应创建成功');
    assert.ok(extResult.id, '延期申请ID不应为空');
    
    const milestoneAfterRequest = await getMilestoneById(milestoneId);
    assert.strictEqual(milestoneAfterRequest?.status, 'extension_requested', '里程碑状态应为延期申请中');
    
    const reviewResult = await reviewExtensionRequest(
      extResult.id!,
      'approved',
      'reviewer',
      '审核通过，情况属实'
    );
    assert.ok(reviewResult.success, '审核应成功');
    
    const milestoneAfterReview = await getMilestoneById(milestoneId);
    assert.strictEqual(milestoneAfterReview?.status, 'confirmed', '里程碑状态应为已确认');
    assert.strictEqual(milestoneAfterReview?.planned_date, '2025-01-31', '里程碑日期应已更新');
  });
  
  await runTest('2. 冲突记录: 重复审核应失败', async () => {
    const projectId = await createProject({ name: '测试项目B', code: 'TEST-002' }, 'tester');
    const milestoneId = await createMilestone({
      project_id: projectId,
      name: '冲突测试里程碑',
      planned_date: '2024-12-31',
      created_by: 'tester'
    });
    
    const extResult = await createExtensionRequest({
      milestone_id: milestoneId,
      requested_by: 'tester',
      requested_date: '2025-02-28',
      reason: '这是冲突测试用的延期原因',
      impact_scope: '这是冲突测试用的影响范围'
    });
    
    await reviewExtensionRequest(extResult.id!, 'approved', 'reviewer', '第一次审核');
    
    const secondReview = await reviewExtensionRequest(extResult.id!, 'rejected', 'reviewer2', '第二次审核');
    assert.ok(!secondReview.success, '重复审核应失败');
    assert.deepStrictEqual(secondReview.errors, ['申请已处理，不能重复审核'], '错误消息应匹配');
  });
  
  await runTest('3. 导入坏行: 延期日期早于原日期应验证失败', async () => {
    const projectId = await createProject({ name: '测试项目C', code: 'TEST-003' }, 'tester');
    const milestoneId = await createMilestone({
      project_id: projectId,
      name: '坏行测试里程碑',
      planned_date: '2024-12-31',
      created_by: 'tester'
    });
    
    const errors = await validateExtensionRequest({
      milestone_id: milestoneId,
      requested_by: 'tester',
      original_date: '2024-12-31',
      requested_date: '2024-11-30',
      reason: '日期错误的申请',
      impact_scope: '日期错误的影响范围'
    });
    
    assert.ok(errors.length > 0, '应有验证错误');
    assert.ok(errors.some(e => e.field === 'requested_date'), '应有日期字段错误');
  });
  
  await runTest('4. 历史记录: 父里程碑延期后子任务应有警告记录', async () => {
    const projectId = await createProject({ name: '测试项目D', code: 'TEST-004' }, 'tester');
    
    const parentId = await createMilestone({
      project_id: projectId,
      name: '父里程碑',
      planned_date: '2024-12-31',
      created_by: 'tester'
    });
    
    const childId = await createMilestone({
      project_id: projectId,
      parent_id: parentId,
      name: '子任务',
      planned_date: '2024-11-30',
      created_by: 'tester'
    });
    
    const extResult = await createExtensionRequest({
      milestone_id: parentId,
      requested_by: 'tester',
      requested_date: '2025-03-31',
      reason: '父里程碑需要延期',
      impact_scope: '影响所有子任务'
    });
    
    await reviewExtensionRequest(extResult.id!, 'approved', 'reviewer', '同意延期');
    
    const childHistory = await getHistoryByEntity('milestone', childId);
    const warningRecord = childHistory.find(h => h.action === 'warning');
    assert.ok(warningRecord, '子任务应有警告历史记录');
    assert.ok(warningRecord?.comment?.includes('未同步'), '警告记录应包含未同步提示');
  });
  
  await runTest('5. 状态流转: in_progress -> extension_requested -> confirmed -> closed', async () => {
    const projectId = await createProject({ name: '测试项目E', code: 'TEST-005' }, 'tester');
    const milestoneId = await createMilestone({
      project_id: projectId,
      name: '状态流转测试',
      planned_date: '2024-12-31',
      created_by: 'tester'
    });
    
    let milestone = await getMilestoneById(milestoneId);
    assert.strictEqual(milestone?.status, 'in_progress', '初始状态应为进行中');
    
    const extResult = await createExtensionRequest({
      milestone_id: milestoneId,
      requested_by: 'tester',
      requested_date: '2025-04-30',
      reason: '状态流转测试延期原因',
      impact_scope: '状态流转测试影响范围'
    });
    
    milestone = await getMilestoneById(milestoneId);
    assert.strictEqual(milestone?.status, 'extension_requested', '提交申请后应为延期申请中');
    
    await reviewExtensionRequest(extResult.id!, 'approved', 'reviewer', '审核通过');
    
    milestone = await getMilestoneById(milestoneId);
    assert.strictEqual(milestone?.status, 'confirmed', '审核通过后应为已确认');
    
    await updateMilestoneStatus(milestoneId, 'closed', 'tester', '任务完成，关闭');
    
    milestone = await getMilestoneById(milestoneId);
    assert.strictEqual(milestone?.status, 'closed', '最终状态应为已关闭');
  });
  
  await runTest('6. 列表-详情-历史互相对齐', async () => {
    const allHistory = await getAllHistory();
    assert.ok(allHistory.length > 0, '应有历史记录');
    
    const firstHistory = allHistory[0];
    const entityHistory = await getHistoryByEntity(firstHistory.entity_type, firstHistory.entity_id);
    assert.ok(entityHistory.length > 0, '按实体查询历史应有结果');
  });
  
  console.log('\n=== 测试结果汇总 ===');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`通过: ${passed}, 失败: ${failed}`);
  
  if (failed > 0) {
    console.log('\n失败的测试:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
  }
  
  await closeDB();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
