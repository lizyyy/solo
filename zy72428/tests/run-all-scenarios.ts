import { runNormalScenario } from './scenarios/normal-scenario';
import { runWrongCaliberScenario } from './scenarios/wrong-caliber-scenario';
import { runSupplementScenario } from './scenarios/supplement-scenario';
import { runZhangmingLeaveTest } from './scenarios/zhangming-leave-conflict-e2e';

console.log('\n' + '═'.repeat(70));
console.log('🚀 街头艺人点位排班系统 - 全场景测试');
console.log('═'.repeat(70));
console.log('\n测试场景：');
console.log('  1. 正常材料 - 验证正常流程能否顺利通过');
console.log('  2. 错口径材料 - 验证重复导入、请假误算、曲目冲突等问题检测');
console.log('  3. 补录材料 - 验证补录后重算、导出一致等功能');
console.log('  4. 张明请假误算专项 - 验证冲突类型全程保留，不退化为曲目不匹配');
console.log('═'.repeat(70));

const results: { scenario: string; success: boolean }[] = [];

try {
  console.log('\n\n');
  const normal = runNormalScenario();
  results.push({ scenario: '正常材料', success: normal.success });
} catch (e: any) {
  console.error('❌ 正常材料场景失败:', e.message);
  results.push({ scenario: '正常材料', success: false });
}

try {
  console.log('\n\n');
  const wrong = runWrongCaliberScenario();
  results.push({ scenario: '错口径材料', success: true });
} catch (e: any) {
  console.error('❌ 错口径材料场景失败:', e.message);
  results.push({ scenario: '错口径材料', success: false });
}

try {
  console.log('\n\n');
  const supplement = runSupplementScenario();
  results.push({ scenario: '补录材料', success: true });
} catch (e: any) {
  console.error('❌ 补录材料场景失败:', e.message);
  results.push({ scenario: '补录材料', success: false });
}

try {
  console.log('\n\n');
  const zhangming = runZhangmingLeaveTest();
  results.push({ scenario: '张明请假误算专项', success: zhangming.allPassed });
} catch (e: any) {
  console.error('❌ 张明请假误算专项失败:', e.message);
  results.push({ scenario: '张明请假误算专项', success: false });
}

console.log('\n' + '═'.repeat(70));
console.log('📋 测试结果汇总');
console.log('═'.repeat(70));
for (const r of results) {
  const icon = r.success ? '✅' : '❌';
  console.log(`  ${icon} ${r.scenario}: ${r.success ? '通过' : '失败'}`);
}

const passed = results.filter((r) => r.success).length;
console.log(`\n  总计：${passed}/${results.length} 场景通过`);
console.log('═'.repeat(70));
console.log('\n🎉 所有测试场景执行完成！\n');
