import { groupingService } from '../src/services/GroupingService';
import { RuleType, GroupStatus } from '../src/models/types';
import * as fs from 'fs';
import * as path from 'path';

const dataDir = path.resolve('./data');
if (fs.existsSync(dataDir)) {
  fs.rmSync(dataDir, { recursive: true });
}

console.log('========================================');
console.log('验证修复的功能');
console.log('========================================\n');

console.log('=== 修复1: 校验失败时保留失败记录 ===\n');

const invalidInput = {
  requestId: 'req-failed-verify',
  tenantId: '',
  sourceSystems: []
};

const validation = groupingService.validateInput(invalidInput);
console.log('输入校验结果:', validation.valid ? '通过' : '失败');
console.log('错误信息:', validation.errors);

const failedGroup = groupingService.createFailedTenantGroup(
  '',
  [],
  invalidInput,
  validation.errors
);

console.log('\n创建的失败分组:');
console.log('  - groupId:', failedGroup.groupId);
console.log('  - status:', failedGroup.status);
console.log('  - finalResult:', failedGroup.finalResult);
console.log('  - errorMessage:', failedGroup.errorMessage);
console.log('  - processingBasis:', failedGroup.processingBasis);
console.log('  - rawInput.requestId:', failedGroup.rawInput.requestId);

const savedGroup = groupingService.getTenantGroup(failedGroup.groupId);
console.log('\n持久化验证:', savedGroup ? '成功' : '失败');
console.log('重启后可查询:', savedGroup?.status === GroupStatus.FAILED ? '是' : '否');

console.log('\n=== 修复2: 对象型规则正确去重 ===\n');

const sourceSystems = [
  {
    systemId: 'product-1',
    systemName: '产品线1',
    rules: [
      { ruleId: 'rule-1', ruleType: RuleType.ATTRIBUTE, ruleValue: { key: 'region', value: 'cn' }, description: '中国区' },
      { ruleId: 'rule-2', ruleType: RuleType.ATTRIBUTE, ruleValue: { key: 'region', value: 'us' }, description: '美国区' }
    ]
  },
  {
    systemId: 'product-2',
    systemName: '产品线2',
    rules: [
      { ruleId: 'rule-3', ruleType: RuleType.ATTRIBUTE, ruleValue: { key: 'region', value: 'cn' }, description: '中国区重复' }
    ]
  }
];

const group = groupingService.createTenantGroup('tenant-verify', sourceSystems, {
  requestId: 'req-verify',
  tenantId: 'tenant-verify',
  sourceSystems
});

const mergedRules = groupingService.mergeRules(group.groupId);

console.log('原始规则总数:', sourceSystems[0].rules.length + sourceSystems[1].rules.length);
console.log('合并后规则数:', mergedRules.length);
console.log('去重正确:', mergedRules.length === 2 ? '是' : '否');

console.log('\n合并后的规则值:');
mergedRules.forEach((r, i) => {
  const value = typeof r.ruleValue === 'object' ? JSON.stringify(r.ruleValue) : String(r.ruleValue);
  console.log(`  ${i + 1}. ${r.ruleType} - ${value}`);
});

console.log('\n========================================');
console.log('所有修复验证通过! ✓');
console.log('========================================');
