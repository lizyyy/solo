import { initDatabase } from '../src/database';
import {
  createSyncBatch,
  validateSyncBatch,
  getDepartmentNodes,
  getExceptionNodes
} from '../src/sync-service';

async function main() {
  await initDatabase();
  console.log('数据库初始化完成');

  // 测试1: 部门树层级计算
  console.log('\n=== 测试1: 部门树层级计算 ===');
  const batch1 = await createSyncBatch({
    source: 'TEST-HR',
    departments: [
      { deptId: 'L1', deptName: '一级', parentDeptId: null },
      { deptId: 'L2', deptName: '二级', parentDeptId: 'L1' },
      { deptId: 'L3', deptName: '三级', parentDeptId: 'L2' }
    ],
    createdBy: 'tester'
  });

  await validateSyncBatch(batch1.id);
  const nodes = await getDepartmentNodes(batch1.id);
  console.log('部门节点:');
  nodes.forEach(n => console.log(`  ${n.deptId}: 层级=${n.level}, 父级=${n.parentDeptId}`));

  const L1 = nodes.find(n => n.deptId === 'L1');
  const L3 = nodes.find(n => n.deptId === 'L3');

  if (L1?.level === 1 && L3?.level === 3) {
    console.log('✓ 部门树层级计算正确！\n');
  } else {
    console.error(`✗ 层级计算错误: L1=${L1?.level}, L3=${L3?.level}`);
    process.exit(1);
  }

  // 测试2: 重复ID异常捕获
  console.log('=== 测试2: 重复ID异常捕获 ===');
  const batch2 = await createSyncBatch({
    source: 'TEST-DUPLICATE',
    departments: [
      { deptId: 'A', deptName: '部门A', parentDeptId: null },
      { deptId: 'A', deptName: '部门A-重复', parentDeptId: null }
    ],
    createdBy: 'tester'
  });

  const exceptions = await getExceptionNodes(batch2.id);
  console.log(`异常数: ${exceptions.length}`);
  exceptions.forEach(e => {
    console.log(`  类型: ${e.errorType}, 部门: ${e.deptId}`);
    console.log(`    原始输入已保留: ${e.rawInput ? '是' : '否'}`);
    console.log(`    处理依据已保留: ${e.processingBasis ? '是' : '否'}`);
  });

  const duplicateException = exceptions.find(e => e.errorType === 'DUPLICATE_ID');
  if (duplicateException && duplicateException.rawInput && duplicateException.processingBasis) {
    console.log('✓ 重复ID异常正确捕获并保留了完整失败路径信息！\n');
  } else {
    console.error('✗ 重复ID异常处理不正确');
    process.exit(1);
  }

  // 测试3: 缺失父级异常捕获
  console.log('=== 测试3: 缺失父级异常捕获 ===');
  const batch3 = await createSyncBatch({
    source: 'TEST-MISSING-PARENT',
    departments: [
      { deptId: 'ROOT', deptName: '根部门', parentDeptId: null },
      { deptId: 'CHILD', deptName: '子部门', parentDeptId: 'NONEXISTENT' }
    ],
    createdBy: 'tester'
  });

  await validateSyncBatch(batch3.id);
  const exceptions3 = await getExceptionNodes(batch3.id);
  const missingParentException = exceptions3.find(e => e.errorType === 'MISSING_PARENT');

  console.log(`异常数: ${exceptions3.length}`);
  if (missingParentException) {
    console.log(`  缺失父级异常已捕获: ${missingParentException.errorMessage}`);
    console.log('✓ 缺失父级异常正确捕获！\n');
  } else {
    console.error('✗ 缺失父级异常未正确捕获');
    process.exit(1);
  }

  console.log('=== 所有修复验证通过！ ===');
  console.log('\n总结:');
  console.log('✓ 1. 部门树层级计算修复 - 使用下划线字段名访问数据库字段');
  console.log('✓ 2. 重复ID异常捕获 - 创建批次时即检查并记录异常，保留原始输入和处理依据');
  console.log('✓ 3. 缺失父级异常捕获 - 树结构校验时正确识别并记录异常');
  process.exit(0);
}

main().catch(console.error);
