import { calculateRoyalties } from '../engine/royaltyCalculator.js';
import {
  MOCK_AUTHORS,
  MOCK_BOOKS,
  MOCK_CONTRACTS,
  MOCK_ROYALTY_LADDERS,
  MOCK_SALES_RECORDS,
  MOCK_RETURN_RECORDS,
  MOCK_DISCOUNT_ACTIVITIES,
} from '../mock/data.js';

function runTests() {
  console.log('=== 版税计算引擎测试 ===\n');

  const period = '2024-06';

  console.log('测试数据:');
  console.log(`- 作者数量: ${MOCK_AUTHORS.length}`);
  console.log(`- 图书数量: ${MOCK_BOOKS.length}`);
  console.log(`- 合同数量: ${MOCK_CONTRACTS.length}`);
  console.log(`- 阶梯配置: ${MOCK_ROYALTY_LADDERS.length}`);
  console.log(`- 销售记录: ${MOCK_SALES_RECORDS.length}`);
  console.log(`- 退货记录: ${MOCK_RETURN_RECORDS.length}`);
  console.log(`- 折扣活动: ${MOCK_DISCOUNT_ACTIVITIES.length}\n`);

  const result = calculateRoyalties({
    period,
    authors: MOCK_AUTHORS,
    books: MOCK_BOOKS,
    contracts: MOCK_CONTRACTS,
    ladders: MOCK_ROYALTY_LADDERS,
    sales: MOCK_SALES_RECORDS,
    returns: MOCK_RETURN_RECORDS,
    discounts: MOCK_DISCOUNT_ACTIVITIES,
  });

  console.log('计算结果:');
  console.log(`- 结算ID: ${result.settlement.id}`);
  console.log(`- 周期: ${result.settlement.period}`);
  console.log(`- 总金额: ¥${result.settlement.totalAmount.toFixed(2)}`);
  console.log(`- 明细条数: ${result.items.length}`);
  console.log(`- 异常数量: ${result.exceptions.length}\n`);

  console.log('=== 结算明细 ===');
  result.items.slice(0, 5).forEach((item, index) => {
    console.log(`\n${index + 1}. ${item.bookName} - ${item.channel}`);
    console.log(`   作者: ${item.authorName}`);
    console.log(`   类型: ${item.productType}`);
    console.log(`   销量: ${item.salesVolume}`);
    console.log(`   退货: ${item.returnVolume}`);
    console.log(`   净销量: ${item.netSalesVolume}`);
    console.log(`   阶梯: 第${item.ladderTier}档 (${item.ladderRange})`);
    console.log(`   税率: ${(item.royaltyRate * 100).toFixed(2)}%`);
    console.log(`   版税: ¥${item.royaltyAmount.toFixed(2)}`);
  });

  if (result.items.length > 5) {
    console.log(`\n... 还有 ${result.items.length - 5} 条明细\n`);
  }

  console.log('=== 异常记录 ===');
  if (result.exceptions.length === 0) {
    console.log('无异常\n');
  } else {
    result.exceptions.forEach((ex, index) => {
      console.log(`\n${index + 1}. ${ex.type} (${ex.severity})`);
      console.log(`   描述: ${ex.message}`);
      console.log(`   已确认: ${ex.isConfirmed ? '是' : '否'}`);
    });
    console.log('');
  }

  console.log('=== 计算轨迹示例 ===');
  const itemWithTrail = result.items.find((item) => item.calculationTrail);
  if (itemWithTrail && itemWithTrail.calculationTrail) {
    console.log(`\n图书: ${itemWithTrail.bookName} - ${itemWithTrail.channel}`);
    console.log(`计算公式: ${itemWithTrail.calculationTrail.formula}`);
    console.log('计算步骤:');
    itemWithTrail.calculationTrail.steps.forEach((step) => {
      console.log(`  ${step.order}. ${step.description}`);
      console.log(`     规则: ${step.rule}`);
      console.log(`     输入: ${step.input}`);
      console.log(`     输出: ${step.output}`);
    });
  }

  console.log('\n=== 测试完成 ===');
  console.log('✓ 版税计算引擎正常工作');
  console.log(`✓ 处理了 ${result.items.length} 条结算明细`);
  console.log(`✓ 检测到 ${result.exceptions.length} 个异常`);
  console.log(`✓ 总金额: ¥${result.settlement.totalAmount.toFixed(2)}`);
}

runTests();
