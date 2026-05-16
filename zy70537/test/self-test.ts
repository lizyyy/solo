import { groupingService } from '../src/services/GroupingService';
import { RuleType, GroupStatus } from '../src/models/types';
import * as fs from 'fs';
import * as path from 'path';

const dataDir = path.resolve('./data');
if (fs.existsSync(dataDir)) {
  fs.rmSync(dataDir, { recursive: true });
}

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const testResults: TestResult[] = [];

function test(name: string, fn: () => void): void {
  try {
    fn();
    testResults.push({ name, passed: true });
    console.log(`✓ ${name}`);
  } catch (error) {
    testResults.push({
      name,
      passed: false,
      error: error instanceof Error ? error.message : '未知错误'
    });
    console.log(`✗ ${name}: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

function assertEqual(actual: unknown, expected: unknown, message?: string): void {
  if (actual !== expected) {
    throw new Error(`${message || '断言失败'}: 期望 ${expected}, 实际 ${actual}`);
  }
}

function assertTrue(value: unknown, message?: string): void {
  if (!value) {
    throw new Error(`${message || '断言失败'}: 期望为真值, 实际为 ${value}`);
  }
}

function assertFalse(value: unknown, message?: string): void {
  if (value) {
    throw new Error(`${message || '断言失败'}: 期望为假值, 实际为 ${value}`);
  }
}

console.log('========================================');
console.log('开始运行灰度租户分组API自检脚本');
console.log('========================================\n');

console.log('--- 场景1: 正常流程测试 ---\n');

test('创建租户分组', () => {
  const sourceSystems = [
    {
      systemId: 'product-a',
      systemName: '产品线A',
      rules: [
        { ruleId: 'rule-1', ruleType: RuleType.WHITELIST, ruleValue: 'tenant-001', description: '白名单' }
      ]
    }
  ];

  const group = groupingService.createTenantGroup('tenant-001', sourceSystems, {
    requestId: 'req-001',
    tenantId: 'tenant-001',
    sourceSystems
  });

  assertEqual(group.tenantId, 'tenant-001');
  assertEqual(group.status, GroupStatus.PENDING);
  assertTrue(group.groupId);
});

test('规则合并', () => {
  const groups = groupingService.getAllTenantGroups();
  const groupId = groups[0].groupId;

  const mergedRules = groupingService.mergeRules(groupId);

  assertEqual(mergedRules.length, 1);
  assertEqual(mergedRules[0].ruleType, RuleType.WHITELIST);
});

test('计算命中结果', () => {
  const groups = groupingService.getAllTenantGroups();
  const groupId = groups[0].groupId;

  const hitResults = groupingService.calculateHit(groupId, { tenantId: 'tenant-001' });

  assertEqual(hitResults.length, 1);
  assertTrue(hitResults[0].overallHit);

  const group = groupingService.getTenantGroup(groupId);
  assertEqual(group?.status, GroupStatus.SUCCESS);
  assertTrue(group?.finalResult);
});

test('生成分组报告', () => {
  const groups = groupingService.getAllTenantGroups();
  const groupId = groups[0].groupId;

  const report = groupingService.generateReport(groupId);

  assertEqual(report.groupId, groupId);
  assertTrue(report.reportId);
  assertTrue(report.finalResult);
});

test('导出CSV报告', () => {
  const groups = groupingService.getAllTenantGroups();
  const groupId = groups[0].groupId;

  const report = groupingService.generateReport(groupId);
  const csvContent = groupingService.exportReport(report.reportId);

  assertTrue(csvContent.includes('报告ID'));
  assertTrue(csvContent.includes(groupId));
});

console.log('\n--- 场景2: 脏数据测试 ---\n');

test('缺少tenantId的输入验证', () => {
  const result = groupingService.validateInput({
    sourceSystems: []
  });

  assertFalse(result.valid);
  assertTrue(result.errors.some(e => e.includes('tenantId')));
});

test('缺少sourceSystems的输入验证', () => {
  const result = groupingService.validateInput({
    tenantId: 'tenant-001'
  });

  assertFalse(result.valid);
  assertTrue(result.errors.some(e => e.includes('sourceSystems')));
});

test('sourceSystems缺少systemId的输入验证', () => {
  const result = groupingService.validateInput({
    tenantId: 'tenant-001',
    sourceSystems: [{ rules: [] }]
  });

  assertFalse(result.valid);
  assertTrue(result.errors.some(e => e.includes('systemId')));
});

test('规则缺少ruleId的输入验证', () => {
  const result = groupingService.validateInput({
    tenantId: 'tenant-001',
    sourceSystems: [
      {
        systemId: 'product-a',
        rules: [{ ruleType: RuleType.WHITELIST }]
      }
    ]
  });

  assertFalse(result.valid);
  assertTrue(result.errors.some(e => e.includes('ruleId')));
});

console.log('\n--- 场景3: 重复请求测试 ---\n');

test('相同requestId创建分组应返回已存在的分组', () => {
  const sourceSystems = [
    {
      systemId: 'product-b',
      systemName: '产品线B',
      rules: [
        { ruleId: 'rule-2', ruleType: RuleType.PERCENTAGE, ruleValue: 50, description: '50%流量' }
      ]
    }
  ];

  const group1 = groupingService.createTenantGroup('tenant-002', sourceSystems, {
    requestId: 'req-duplicate',
    tenantId: 'tenant-002',
    sourceSystems
  });

  const group2 = groupingService.createTenantGroup('tenant-002', sourceSystems, {
    requestId: 'req-duplicate',
    tenantId: 'tenant-002',
    sourceSystems
  });

  assertEqual(group1.groupId, group2.groupId);
});

console.log('\n--- 场景4: 人工修正和重计算测试 ---\n');

test('人工修正分组结果', () => {
  const sourceSystems = [
    {
      systemId: 'product-c',
      systemName: '产品线C',
      rules: [
        { ruleId: 'rule-3', ruleType: RuleType.BLACKLIST, ruleValue: 'tenant-003', description: '黑名单' }
      ]
    }
  ];

  const group = groupingService.createTenantGroup('tenant-003', sourceSystems, {
    requestId: 'req-003',
    tenantId: 'tenant-003',
    sourceSystems
  });

  groupingService.calculateHit(group.groupId, { tenantId: 'tenant-003' });

  const adjustedGroup = groupingService.manualAdjustment(
    group.groupId,
    'operator-admin',
    false,
    '特殊客户豁免'
  );

  assertFalse(adjustedGroup.finalResult);
  assertEqual(adjustedGroup.adjustmentRecords.length, 1);
  assertEqual(adjustedGroup.adjustmentRecords[0].operator, 'operator-admin');
});

test('人工修正后重新计算', () => {
  const groups = groupingService.getAllTenantGroups();
  const group = groups.find(g => g.tenantId === 'tenant-003');
  assertTrue(group);

  const hitResults = groupingService.recalculateAfterAdjustment(group!.groupId, { tenantId: 'tenant-003' });

  assertEqual(hitResults.length, 1);
  assertTrue(hitResults[0].overallHit);
});

console.log('\n--- 场景5: 异常处理和状态推进 ---\n');

test('异常处理转入人工审核', () => {
  const sourceSystems = [
    {
      systemId: 'product-d',
      systemName: '产品线D',
      rules: [
        { ruleId: 'rule-4', ruleType: RuleType.ATTRIBUTE, ruleValue: { key: 'region', value: 'cn' }, description: '区域属性' }
      ]
    }
  ];

  const group = groupingService.createTenantGroup('tenant-004', sourceSystems, {
    requestId: 'req-004',
    tenantId: 'tenant-004',
    sourceSystems
  });

  const handledGroup = groupingService.handleException(group.groupId, '规则冲突，无法自动判定');

  assertEqual(handledGroup.status, GroupStatus.MANUAL_REVIEW);
  assertEqual(handledGroup.errorMessage, '规则冲突，无法自动判定');
});

test('手动推进分组状态', () => {
  const groups = groupingService.getAllTenantGroups();
  const group = groups.find(g => g.tenantId === 'tenant-004');
  assertTrue(group);

  const updatedGroup = groupingService.advanceStatus(group!.groupId, GroupStatus.PROCESSING);

  assertEqual(updatedGroup.status, GroupStatus.PROCESSING);
});

console.log('\n--- 场景6: 多来源系统规则合并 ---\n');

test('多个来源系统规则去重合并', () => {
  const sourceSystems = [
    {
      systemId: 'product-x',
      systemName: '产品线X',
      rules: [
        { ruleId: 'rule-x1', ruleType: RuleType.WHITELIST, ruleValue: 'tenant-005', description: '白名单X' },
        { ruleId: 'rule-x2', ruleType: RuleType.PERCENTAGE, ruleValue: 30, description: '30%流量' }
      ]
    },
    {
      systemId: 'product-y',
      systemName: '产品线Y',
      rules: [
        { ruleId: 'rule-y1', ruleType: RuleType.WHITELIST, ruleValue: 'tenant-005', description: '白名单Y' },
        { ruleId: 'rule-y2', ruleType: RuleType.ATTRIBUTE, ruleValue: { key: 'vip', value: 'true' }, description: 'VIP用户' }
      ]
    }
  ];

  const group = groupingService.createTenantGroup('tenant-005', sourceSystems, {
    requestId: 'req-005',
    tenantId: 'tenant-005',
    sourceSystems
  });

  const mergedRules = groupingService.mergeRules(group.groupId);

  assertEqual(mergedRules.length, 3);
});

console.log('\n========================================');
console.log('测试结果汇总');
console.log('========================================');

const passed = testResults.filter(r => r.passed).length;
const failed = testResults.filter(r => !r.passed).length;

console.log(`总计: ${testResults.length} 个测试`);
console.log(`通过: ${passed} 个`);
console.log(`失败: ${failed} 个`);

if (failed > 0) {
  console.log('\n失败的测试:');
  testResults.filter(r => !r.passed).forEach(r => {
    console.log(`  - ${r.name}: ${r.error}`);
  });
}

console.log('\n========================================');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('所有测试通过! ✓');
  process.exit(0);
}
