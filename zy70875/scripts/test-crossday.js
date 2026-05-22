const { calculateSubsidy } = require('../src/services/calculationService');

console.log('=== 跨日场拆分测试 ===\n');

const crossDayScreening = {
  screeningId: 'S002',
  cinemaId: 'C001',
  cinemaName: '万达影城CBD店',
  filmId: 'F002',
  filmName: '银河护卫队3',
  startTime: '2024-05-01T23:00:00+08:00',
  endTime: '2024-05-02T01:30:00+08:00',
  totalBoxOffice: 8000,
  refundAmount: 3000,
  audienceCount: 100,
  hasMinimumGuarantee: true,
  guaranteeAmount: 6000,
  isCrossDay: true
};

console.log('测试场次: 2024-05-01 23:00 至 2024-05-02 01:30');
console.log('总票房: 8000元，退票: 3000元，保底金额: 6000元\n');

const result = calculateSubsidy(crossDayScreening);
const details = result.calculationDetails;

console.log('=== 核算结果 ===');
console.log('分类:', result.category);
console.log('原因:', result.reason);
console.log('补贴金额:', result.subsidyAmount, '元');

console.log('\n=== 跨日拆分详情 ===');
console.log('是否跨日:', details.isCrossDay);

if (details.crossDaySplit) {
  console.log('拆分结果:');
  details.crossDaySplit.forEach((split, i) => {
    console.log(`  第${i + 1}天: ${split.date} - ${split.amount} 元`);
  });
  
  const totalSplit = details.crossDaySplit.reduce((sum, s) => sum + s.amount, 0);
  console.log(`  拆分总计: ${totalSplit} 元`);
  console.log(`  最终票房: ${details.finalBoxOffice} 元`);
} else {
  console.log('❌ 错误: 没有跨日拆分数据！');
}

console.log('\n=== 退票与保底 ===');
console.log('原始票房:', details.originalBoxOffice, '元');
console.log('退票扣款:', details.refundDeduction, '元');
console.log('退票率:', (details.refundRatio * 100).toFixed(1) + '%');
console.log('净票房:', details.netBoxOffice, '元');
console.log('保底生效:', details.guaranteeApplied ? '是' : '否');
console.log('保底金额:', details.guaranteeAmount, '元');
console.log('最终票房:', details.finalBoxOffice, '元');

console.log('\n=== 验证 ===');
const expectedDates = ['2024-05-01', '2024-05-02'];
const actualDates = details.crossDaySplit ? details.crossDaySplit.map(s => s.date) : [];
const datesMatch = actualDates.length === 2 && 
                   actualDates[0] === expectedDates[0] && 
                   actualDates[1] === expectedDates[1];

if (datesMatch) {
  console.log('✅ 跨日拆分日期正确! (2024-05-01 和 2024-05-02)');
  
  const durationHours = 2.5; // 23:00 - 01:30 = 2.5小时
  const day1Hours = 1; // 23:00 - 00:00 = 1小时
  const day2Hours = 1.5; // 00:00 - 01:30 = 1.5小时
  
  const expectedDay1 = Number((details.finalBoxOffice * (day1Hours / durationHours)).toFixed(2));
  const expectedDay2 = Number((details.finalBoxOffice * (day2Hours / durationHours)).toFixed(2));
  
  const actualDay1 = details.crossDaySplit[0].amount;
  const actualDay2 = details.crossDaySplit[1].amount;
  
  if (Math.abs(actualDay1 - expectedDay1) < 1 && Math.abs(actualDay2 - expectedDay2) < 1) {
    console.log('✅ 跨日拆分金额比例正确!');
    console.log(`   按时长 1:1.5 拆分，最终票房 ${details.finalBoxOffice} 元`);
    console.log(`   第一天: ${actualDay1} 元 (预期约 ${expectedDay1} 元)`);
    console.log(`   第二天: ${actualDay2} 元 (预期约 ${expectedDay2} 元)`);
  } else {
    console.log('❌ 跨日拆分金额比例不正确!');
    console.log(`   预期第一天: ${expectedDay1} 元, 实际: ${actualDay1} 元`);
    console.log(`   预期第二天: ${expectedDay2} 元, 实际: ${actualDay2} 元`);
  }
} else {
  console.log('❌ 跨日拆分日期不正确!');
  console.log('   预期:', expectedDates);
  console.log('   实际:', actualDates);
}

console.log('\n=== 测试完成 ===');
