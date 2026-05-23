const store = require('./src/store');
const pointsCalculator = require('./src/services/pointsCalculator');
const Receipt = require('./src/models/Receipt');

console.log('=== 验证修复结果 ===\n');

console.log('1. 验证 Promotion 模型:');
const promotions = store.getAllPromotions();
const goldBonus = promotions.find(p => p.name === 'Gold Member Bonus');
console.log('   Gold Member Bonus memberLevels:', goldBonus.memberLevels);
console.log('   结果:', JSON.stringify(goldBonus.memberLevels).toString() === JSON.stringify(['GOLD', 'PLATINUM']).toString() ? '✅ 通过' : '❌ 失败');
console.log();

console.log('2. 验证 R001 (M001 GOLD会员，500元):');
const receipt1 = new Receipt({ receiptNo: 'R001', storeId: 'S001', memberNo: 'M001', amount: 500, transactionDate: '2025-01-01T10:00:00' });
const member1 = store.getMember('M001');
const result1 = pointsCalculator.calculateExpectedPoints(receipt1, member1);
console.log('   会员等级:', member1.level);
console.log('   适用活动:', result1.details.appliedPromotions.map(p => p.name).join(', '));
console.log('   最终积分:', result1.points);
console.log('   期望: 1500, 结果:', result1.points === 1500 ? '✅ 通过' : '❌ 失败');
console.log();

console.log('3. 验证 R002 (M002 SILVER会员，150元):');
const receipt2 = new Receipt({ receiptNo: 'R002', storeId: 'S001', memberNo: 'M002', amount: 150, transactionDate: '2025-01-01T10:00:00' });
const member2 = store.getMember('M002');
const result2 = pointsCalculator.calculateExpectedPoints(receipt2, member2);
console.log('   会员等级:', member2.level);
console.log('   适用活动:', result2.details.appliedPromotions.map(p => p.name).join(', '));
console.log('   最终积分:', result2.points);
console.log('   期望: 360, 结果:', result2.points === 360 ? '✅ 通过' : '❌ 失败');
console.log();

console.log('4. 验证 R002 没有 Gold Member Bonus:');
const hasGoldBonus = result2.details.appliedPromotions.some(p => p.name === 'Gold Member Bonus');
console.log('   结果:', !hasGoldBonus ? '✅ 通过' : '❌ 失败');
