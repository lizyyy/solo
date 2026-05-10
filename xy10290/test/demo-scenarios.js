process.env.DB_PATH = ':memory:';

const db = require('../src/database');
const campgroundService = require('../src/campground-service');
const settlementService = require('../src/settlement-service');
const issueTracker = require('../src/issue-tracker');

function formatMoney(fen) {
  return `¥${(fen / 100).toFixed(2)}`;
}

function formatTime(ts) {
  return new Date(ts).toLocaleString('zh-CN');
}

console.log('\n' + '='.repeat(80));
console.log('  房车营地水电桩分摊API - 真实场景演示');
console.log('='.repeat(80));

console.log('\n【场景一】正常流程：一辆房车入住 -> 使用水电 -> 退营结算\n');

console.log('步骤1: 创建营地基础设施');
const campsite = campgroundService.createCampsite('阳光湖畔营地');
const spotA = campgroundService.createParkingSpot(campsite.id, 'A-01');
const pillar = campgroundService.createUtilityPillar(campsite.id, 'P-001', 500, 800);
campgroundService.connectPillarToSpot(pillar.id, spotA.id);
console.log(`  ✓ 营地: ${campsite.name}`);
console.log(`  ✓ 车位: ${spotA.spot_number}`);
console.log(`  ✓ 水电桩: ${pillar.pillar_code} (水 ${formatMoney(pillar.water_fee_per_unit)}/单位, 电 ${formatMoney(pillar.electric_fee_per_unit)}/单位)`);

console.log('\n步骤2: 记录初始读数（入住前抄表）');
const checkInTime = Date.now() - 86400000;
const reading1 = campgroundService.recordMeterReading(
  pillar.id, checkInTime, 1000, 2000, 'MANUAL', '入住前抄表'
);
console.log(`  ✓ 初始读数 - 水: ${reading1.water_reading}, 电: ${reading1.electric_reading}`);
console.log(`    时间: ${formatTime(reading1.reading_time)}`);

console.log('\n步骤3: 房车入住（缴纳押金 200元）');
const stay = campgroundService.checkIn(
  campsite.id, spotA.id, '京A-RV8888', 20000, checkInTime
);
console.log(`  ✓ 入住记录: ${stay.id}`);
console.log(`    车牌: ${stay.vehicle_plate}, 押金: ${formatMoney(stay.deposit_amount)}`);
console.log(`    入住时间: ${formatTime(stay.check_in_time)}`);

console.log('\n步骤4: 使用一天后记录新读数');
const checkOutTime = Date.now();
const reading2 = campgroundService.recordMeterReading(
  pillar.id, checkOutTime, 1012, 2025, 'MANUAL', '退营前抄表'
);
console.log(`  ✓ 新读数 - 水: ${reading2.water_reading}, 电: ${reading2.electric_reading}`);
console.log(`    用水量: ${reading2.water_reading - reading1.water_reading} 单位`);
console.log(`    用电量: ${reading2.electric_reading - reading1.electric_reading} 单位`);

console.log('\n步骤5: 执行费用分摊');
const allocation = campgroundService.allocateUtilityUsage(
  pillar.id, reading1.id, reading2.id, 'CHECKOUT', stay.id
);
const alloc = allocation.allocations[0];
console.log(`  ✓ 分摊结果:`);
console.log(`    水: ${alloc.water_units} 单位 × ${formatMoney(pillar.water_fee_per_unit)} = ${formatMoney(alloc.water_cost)}`);
console.log(`    电: ${alloc.electric_units} 单位 × ${formatMoney(pillar.electric_fee_per_unit)} = ${formatMoney(alloc.electric_cost)}`);
console.log(`    合计: ${formatMoney(alloc.total_cost)}`);

console.log('\n步骤6: 退营');
const checkout = settlementService.checkOut(stay.id, checkOutTime);
console.log(`  ✓ 退营成功: ${checkout.status}`);

console.log('\n步骤7: 创建结算单');
const settlement = settlementService.createSettlement(stay.id);
console.log(`  ✓ 结算单: ${settlement.id}`);
console.log(`    实际费用: ${formatMoney(settlement.total_utility_cost)}`);
console.log(`    押金使用: ${formatMoney(settlement.deposit_used)}`);
console.log(`    应退金额: ${formatMoney(settlement.refund_amount)}`);

console.log('\n步骤8: 查看完整入住详情');
const details = settlementService.getFullStayDetails(stay.id);
console.log(`  ✓ 车牌: ${details.stay.vehicle_plate}`);
console.log(`  ✓ 入住: ${formatTime(details.stay.check_in_time)}`);
console.log(`  ✓ 退营: ${formatTime(details.stay.check_out_time)}`);
console.log(`  ✓ 总费用: ${details.summary.total_utility_cost_yuan} 元`);
console.log(`  ✓ 押金: ${details.summary.deposit_amount_yuan} 元`);
console.log(`  ✓ 结余: ${details.summary.balance_yuan} 元`);

console.log('\n' + '-'.repeat(80));

console.log('\n【场景二】问题追踪：押金不足的情况\n');

console.log('步骤1: 新用户入住，只交了100元押金');
const spotB = campgroundService.createParkingSpot(campsite.id, 'A-02');
campgroundService.connectPillarToSpot(pillar.id, spotB.id);
const stay2 = campgroundService.checkIn(
  campsite.id, spotB.id, '沪B-RV9999', 10000, checkInTime
);
console.log(`  ✓ 车牌: ${stay2.vehicle_plate}`);
console.log(`    押金: ${formatMoney(stay2.deposit_amount)}`);

console.log('\n步骤2: 记录读数（这次用了很多水电）');
const reading3 = campgroundService.recordMeterReading(
  pillar.id, checkOutTime + 3600000, 1100, 2200, 'MANUAL', '退营前抄表'
);
console.log(`  ✓ 用水量: ${reading3.water_reading - reading2.water_reading} 单位`);
console.log(`    用电量: ${reading3.electric_reading - reading2.electric_reading} 单位`);

console.log('\n步骤3: 分摊费用');
const allocation2 = campgroundService.allocateUtilityUsage(
  pillar.id, reading2.id, reading3.id, 'CHECKOUT', stay2.id
);
const totalCost = allocation2.allocations.reduce((sum, a) => sum + a.total_cost, 0);
console.log(`  ✓ 预计总费用: ${formatMoney(totalCost)}`);

console.log('\n步骤4: 退营并创建结算（押金不够！）');
settlementService.checkOut(stay2.id, checkOutTime + 7200000);
const settlement2 = settlementService.createSettlement(stay2.id);
console.log(`  ✓ 实际费用: ${formatMoney(settlement2.total_utility_cost)}`);
console.log(`  ✓ 押金金额: ${formatMoney(stay2.deposit_amount)}`);
console.log(`  ✓ 需补缴: ${formatMoney(settlement2.additional_charge)}`);
console.log(`  ✓ 差额原因: ${settlement2.discrepancy_reason}`);

console.log('\n步骤5: 查看问题列表（押金不足已自动记录）');
const issues = issueTracker.getIssues({ status: 'OPEN', issue_type: 'DEPOSIT_SHORTAGE' });
console.log(`  ✓ 待处理问题数: ${issues.length}`);
for (const issue of issues) {
  console.log(`    - [${issue.severity}] ${issue.issue_type}: ${issue.description}`);
}

console.log('\n' + '-'.repeat(80));

console.log('\n【场景三】幂等性演示：重复请求不会乱状态\n');
console.log('（注：幂等性通过 X-Request-Id HTTP头实现，请启动服务后测试）');
console.log('  curl -X POST http://localhost:3000/api/stays/check-in');
console.log('    -H "X-Request-Id: my-unique-id-123"');
console.log('    -H "Content-Type: application/json"');
console.log('    -d \'{...}\'');
console.log('\n  相同 X-Request-Id 的重复请求会返回第一次的结果，不会重复写入');

console.log('\n【场景四】脏数据追踪：读数回退\n');

console.log('步骤1: 记录一个正常读数');
const badReadingTime = Date.now() + 86400000;
const reading4 = campgroundService.recordMeterReading(
  pillar.id, badReadingTime, 2000, 3000, 'MANUAL', '测试读数'
);
console.log(`  ✓ 正常记录 - 水: ${reading4.water_reading}, 电: ${reading4.electric_reading}`);

console.log('\n步骤2: 尝试记录回退读数（应该失败）');
const beforeIssues = issueTracker.getIssueCount({ status: 'OPEN' });

try {
  campgroundService.recordMeterReading(
    pillar.id, badReadingTime + 3600000, 1900, 2900, 'MANUAL', '错误回退'
  );
} catch (e) {
  console.log(`  ✗ 正确拒绝: ${e.message}`);
  
  issueTracker.createIssueFromError(
    e, 'METER_READING', pillar.id,
    { water_reading: 1900, electric_reading: 2900 }
  );
}

const afterIssues = issueTracker.getIssueCount({ status: 'OPEN' });
console.log(`  ✓ 问题列表新增: ${afterIssues - beforeIssues} 条`);

console.log('\n' + '='.repeat(80));
console.log('  演示完成！以下问题需要处理：');
console.log('='.repeat(80));

const openIssues = issueTracker.getIssues({ status: 'OPEN' });
console.log(`\n待处理问题总数: ${openIssues.length}`);

for (const issue of openIssues) {
  console.log(`\n  [${issue.severity}] ${issue.issue_type}`);
  console.log(`    ${issue.description}`);
  console.log(`    来源: ${issue.source_type} / ${issue.source_ref || 'N/A'}`);
  console.log(`    创建时间: ${formatTime(issue.created_at)}`);
}

console.log('\n' + '='.repeat(80));
console.log('  结论：系统已正确追踪所有异常，不会静默跳过脏数据');
console.log('='.repeat(80) + '\n');
