"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const normal_scenario_1 = require("./scenarios/normal-scenario");
const wrong_caliber_scenario_1 = require("./scenarios/wrong-caliber-scenario");
const supplement_scenario_1 = require("./scenarios/supplement-scenario");
const zhangming_leave_conflict_e2e_1 = require("./scenarios/zhangming-leave-conflict-e2e");
console.log('\n' + '═'.repeat(70));
console.log('🚀 街头艺人点位排班系统 - 全场景测试');
console.log('═'.repeat(70));
console.log('\n测试场景：');
console.log('  1. 正常材料 - 验证正常流程能否顺利通过');
console.log('  2. 错口径材料 - 验证重复导入、请假误算、曲目冲突等问题检测');
console.log('  3. 补录材料 - 验证补录后重算、导出一致等功能');
console.log('  4. 张明请假误算专项 - 验证冲突类型全程保留，不退化为曲目不匹配');
console.log('═'.repeat(70));
const results = [];
try {
    console.log('\n\n');
    const normal = (0, normal_scenario_1.runNormalScenario)();
    results.push({ scenario: '正常材料', success: normal.success });
}
catch (e) {
    console.error('❌ 正常材料场景失败:', e.message);
    results.push({ scenario: '正常材料', success: false });
}
try {
    console.log('\n\n');
    const wrong = (0, wrong_caliber_scenario_1.runWrongCaliberScenario)();
    results.push({ scenario: '错口径材料', success: true });
}
catch (e) {
    console.error('❌ 错口径材料场景失败:', e.message);
    results.push({ scenario: '错口径材料', success: false });
}
try {
    console.log('\n\n');
    const supplement = (0, supplement_scenario_1.runSupplementScenario)();
    results.push({ scenario: '补录材料', success: true });
}
catch (e) {
    console.error('❌ 补录材料场景失败:', e.message);
    results.push({ scenario: '补录材料', success: false });
}
try {
    console.log('\n\n');
    const zhangming = (0, zhangming_leave_conflict_e2e_1.runZhangmingLeaveTest)();
    results.push({ scenario: '张明请假误算专项', success: zhangming.allPassed });
}
catch (e) {
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
