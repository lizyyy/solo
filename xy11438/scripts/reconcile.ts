import { initDatabase, closeDatabase } from '../src/database';
import { performReconciliation, getReconciliationSummary } from '../src/services/reconciliation';

async function main() {
  const args = process.argv.slice(2);
  const startDate = args[0] || '2024-01-10';
  const endDate = args[1] || '2024-01-14';

  console.log('=== 民宿保洁排班验收回放链路 - 对账执行 ===\n');
  console.log(`对账期间: ${startDate} ~ ${endDate}\n`);

  await initDatabase();

  const result = await performReconciliation(startDate, endDate);
  
  console.log(getReconciliationSummary(result));

  if (result.mismatchDetails.length > 0) {
    console.log('\n=== 不匹配明细 ===');
    for (const detail of result.mismatchDetails) {
      console.log(`\n${detail.date} 房间${detail.roomId}`);
      console.log(`  事实ID: ${detail.factId}`);
      for (const reason of detail.reasons) {
        console.log(`    ❌ ${reason}`);
      }
      if (detail.orderInfo) {
        console.log(`    📋 订单: ${detail.orderInfo.guestName} ${detail.orderInfo.nights}晚`);
      }
      if (detail.cleaningInfo) {
        console.log(`    🧹 保洁: ${detail.cleaningInfo.cleanerName} ${detail.cleaningInfo.cleaningType} ${detail.cleaningInfo.status}`);
      }
      if (detail.maintenanceCount > 0) {
        console.log(`    🔧 维修: ${detail.maintenanceCount}次`);
      }
      if (detail.approvalCount > 0) {
        console.log(`    📧 审批: ${detail.approvalCount}条`);
      }
    }
  }

  if (result.supplierMatches.length > 0) {
    console.log('\n=== 供应商账单匹配 ===');
    for (const match of result.supplierMatches) {
      const totalItems = match.matchedItems + match.mismatchedItems;
      const rate = totalItems > 0 ? (match.matchedItems / totalItems * 100).toFixed(1) : '0';
      console.log(`\n${match.supplierName} (${match.statementId})`);
      console.log(`  匹配: ${match.matchedItems}/${totalItems}条 (${rate}%)`);
      console.log(`  匹配金额: ¥${match.matchedAmount.toFixed(2)}`);
      console.log(`  不匹配金额: ¥${match.mismatchedAmount.toFixed(2)}`);
    }
  }

  await closeDatabase();

  console.log('\n=== 对账完成 ===');
  console.log('💡 建议操作:');
  console.log('  1. 查看详情: curl "http://localhost:3000/api/facts?startDate=' + startDate + '&endDate=' + endDate + '"');
  console.log('  2. 查看脏记录: curl http://localhost:3000/api/dirty-records');
  console.log('  3. 导出报表: npm run export');
  console.log('  4. 修复异常: npm run replay');
}

main().catch(console.error);
