import { initDatabase } from '../src/database';
import {
  createSyncBatch,
  validateSyncBatch,
  getSyncBatch,
  getDepartmentNodes,
  getExceptionNodes,
  applyManualFix,
  createConsumerSystem,
  startConsumption,
  consumerAck,
  exportSyncReport
} from '../src/sync-service';
import { BatchStatus, NodeStatus } from '../src/types';

let testBatchId: string;
let consumerId: string;
let errorNodeId: string;

async function testNormalFlow() {
  console.log('\n=== 测试1: 正常流程 ===');

  const departments = [
    { deptId: 'D001', deptName: '集团总部', parentDeptId: null, sortOrder: 1 },
    { deptId: 'D002', deptName: '技术部', parentDeptId: 'D001', sortOrder: 1 },
    { deptId: 'D003', deptName: '产品部', parentDeptId: 'D001', sortOrder: 2 },
    { deptId: 'D004', deptName: '前端组', parentDeptId: 'D002', sortOrder: 1 },
    { deptId: 'D005', deptName: '后端组', parentDeptId: 'D002', sortOrder: 2 }
  ];

  const batch = await createSyncBatch({
    source: 'HR-SYSTEM',
    departments,
    createdBy: 'test-user'
  });

  testBatchId = batch.id;
  console.log(`✓ 创建批次成功: ${batch.id}`);
  console.log(`  总节点数: ${batch.totalNodes}`);

  const result = await validateSyncBatch(batch.id);
  console.log(`✓ 验证结果: valid=${result.valid}`);

  const validatedBatch = await getSyncBatch(batch.id);
  console.log(`  批次状态: ${validatedBatch?.status}`);
  console.log(`  有效节点: ${validatedBatch?.validNodes}`);
  console.log(`  无效节点: ${validatedBatch?.invalidNodes}`);

  const nodes = await getDepartmentNodes(batch.id);
  console.log(`  D001层级: ${nodes.find(n => n.deptId === 'D001')?.level}`);
  console.log(`  D004层级: ${nodes.find(n => n.deptId === 'D004')?.level}`);

  if (validatedBatch?.status === BatchStatus.READY && result.valid) {
    console.log('✓ 正常流程测试通过');
  } else {
    throw new Error('正常流程测试失败');
  }
}

async function testDirtyData() {
  console.log('\n=== 测试2: 脏数据（上级部门缺失）===');

  const departments = [
    { deptId: 'E001', deptName: '一级部门', parentDeptId: null },
    { deptId: 'E002', deptName: '二级部门', parentDeptId: 'NOT_EXIST' },
    { deptId: 'E003', deptName: '三级部门', parentDeptId: 'E001' }
  ];

  const batch = await createSyncBatch({
    source: 'DIRTY-HR',
    departments,
    createdBy: 'test-user'
  });

  const result = await validateSyncBatch(batch.id);
  console.log(`✓ 验证结果: valid=${result.valid}`);

  const exceptions = await getExceptionNodes(batch.id);
  console.log(`  异常数量: ${exceptions.length}`);

  const missingParent = exceptions.find(e => e.errorType === 'MISSING_PARENT');
  console.log(`  缺失上级异常: ${missingParent ? '存在' : '缺失'}`);

  const validatedBatch = await getSyncBatch(batch.id);
  console.log(`  批次状态: ${validatedBatch?.status}`);

  if (validatedBatch?.status === BatchStatus.VALIDATION_FAILED && exceptions.length >= 1) {
    console.log('✓ 脏数据测试通过');
    errorNodeId = exceptions[0].nodeId;
  } else {
    throw new Error('脏数据测试失败');
  }
}

async function testDuplicateRequest() {
  console.log('\n=== 测试3: 重复创建批次 ===');

  const departments = [
    { deptId: 'F001', deptName: '测试部门', parentDeptId: null }
  ];

  const batch1 = await createSyncBatch({
    source: 'HR-SYSTEM',
    departments,
    createdBy: 'test-user'
  });

  const batch2 = await createSyncBatch({
    source: 'HR-SYSTEM',
    departments,
    createdBy: 'test-user'
  });

  console.log(`  批次1 ID: ${batch1.id}`);
  console.log(`  批次2 ID: ${batch2.id}`);

  if (batch1.id !== batch2.id) {
    console.log('✓ 重复请求测试通过（批次ID唯一）');
  } else {
    throw new Error('重复请求测试失败（批次ID重复）');
  }
}

async function testManualFixAndRevalidate() {
  console.log('\n=== 测试4: 人工修正后重新验证 ===');

  const departments = [
    { deptId: 'G001', deptName: '总部', parentDeptId: null },
    { deptId: 'G002', deptName: '子部门', parentDeptId: 'INVALID_PARENT' }
  ];

  const batch = await createSyncBatch({
    source: 'HR-TO-FIX',
    departments,
    createdBy: 'test-user'
  });

  await validateSyncBatch(batch.id);

  const exceptions = await getExceptionNodes(batch.id);
  const nodeToFix = exceptions[0];

  console.log(`  修复前状态: 异常已解决=${nodeToFix.isResolved}`);

  const nodes = await getDepartmentNodes(batch.id);
  const targetNode = nodes.find(n => n.deptId === 'G002');

  await applyManualFix({
    nodeId: targetNode!.id,
    fixes: {
      parentDeptId: 'G001'
    },
    operator: 'admin',
    remark: '修正上级部门ID为G001'
  });

  const exceptionsAfter = await getExceptionNodes(batch.id);
  const fixedException = exceptionsAfter.find(e => e.nodeId === targetNode!.id);
  console.log(`  修复后状态: 异常已解决=${fixedException?.isResolved}`);

  const batchAfterFix = await getSyncBatch(batch.id);
  console.log(`  修复后批次状态: ${batchAfterFix?.status}`);

  const revalidateResult = await validateSyncBatch(batch.id);
  console.log(`  重新验证结果: valid=${revalidateResult.valid}`);

  const finalBatch = await getSyncBatch(batch.id);
  console.log(`  最终批次状态: ${finalBatch?.status}`);

  if (finalBatch?.status === BatchStatus.READY && fixedException?.isResolved === true) {
    console.log('✓ 人工修正+重新验证测试通过');
  } else {
    throw new Error('人工修正测试失败');
  }
}

async function testConsumptionFlow() {
  console.log('\n=== 测试5: 消费流程与回执 ===');

  consumerId = await createConsumerSystem('权限管理系统', '负责权限同步的下游系统');
  console.log(`  创建消费系统: ${consumerId}`);

  await startConsumption(testBatchId);
  const consumingBatch = await getSyncBatch(testBatchId);
  console.log(`  开始消费后状态: ${consumingBatch?.status}`);

  await consumerAck(testBatchId, consumerId, true);
  const consumedBatch = await getSyncBatch(testBatchId);
  console.log(`  消费回执后状态: ${consumedBatch?.status}`);

  const nodes = await getDepartmentNodes(testBatchId);
  const allConsumed = nodes.every(n => n.status === NodeStatus.CONSUMED);
  console.log(`  节点全部消费: ${allConsumed}`);

  if (consumedBatch?.status === BatchStatus.CONSUMED && allConsumed) {
    console.log('✓ 消费流程测试通过');
  } else {
    throw new Error('消费流程测试失败');
  }
}

async function testExportReport() {
  console.log('\n=== 测试6: 导出同步报告 ===');

  const report = await exportSyncReport(testBatchId, 'json');
  const reportObj = JSON.parse(report);

  console.log(`  报告包含批次: ${!!reportObj.batch}`);
  console.log(`  报告包含部门数: ${reportObj.departments?.length}`);
  console.log(`  报告包含消费进度: ${!!reportObj.consumerProgress}`);

  if (reportObj.batch && reportObj.departments.length > 0) {
    console.log('✓ 报告导出测试通过');
  } else {
    throw new Error('报告导出测试失败');
  }
}

async function runAllTests() {
  console.log('开始组织架构同步API测试...');

  try {
    await initDatabase();
    console.log('数据库初始化完成');

    await testNormalFlow();
    await testDirtyData();
    await testDuplicateRequest();
    await testManualFixAndRevalidate();
    await testConsumptionFlow();
    await testExportReport();

    console.log('\n=== 所有测试通过！ ===');
    process.exit(0);
  } catch (err: any) {
    console.error('\n❌ 测试失败:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

runAllTests();
