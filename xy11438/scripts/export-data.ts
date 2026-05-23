import { initDatabase, closeDatabase } from '../src/database';
import { exportFactsToJson, exportFactsToCsv, exportDirtyRecordsToJson, exportDirtyRecordsToCsv, exportReconciliationReport, exportReconciliationReportToCsv } from '../src/services/export';
import { performReconciliation } from '../src/services/reconciliation';

async function main() {
  console.log('=== 民宿保洁排班验收回放链路 - 数据导出 ===\n');

  await initDatabase();

  const startDate = '2024-01-10';
  const endDate = '2024-01-14';

  console.log('📊 导出事实记录...');
  const factsJsonPath = await exportFactsToJson(startDate, endDate);
  const factsCsvPath = await exportFactsToCsv(startDate, endDate);
  console.log(`   JSON: ${factsJsonPath}`);
  console.log(`   CSV:  ${factsCsvPath}`);

  console.log('\n⚠️  导出脏记录...');
  const dirtyJsonPath = await exportDirtyRecordsToJson();
  const dirtyCsvPath = await exportDirtyRecordsToCsv();
  console.log(`   JSON: ${dirtyJsonPath}`);
  console.log(`   CSV:  ${dirtyCsvPath}`);

  console.log('\n📋 生成对账报告...');
  const reconcileResult = await performReconciliation(startDate, endDate);
  const reportJsonPath = await exportReconciliationReport(reconcileResult);
  const reportCsvPath = await exportReconciliationReportToCsv(reconcileResult);
  console.log(`   JSON: ${reportJsonPath}`);
  console.log(`   CSV:  ${reportCsvPath}`);

  console.log('\n=== 导出完成 ===');
  console.log('\n📁 导出文件位置: ./exports/');
  console.log(`   - 事实记录: ${startDate} ~ ${endDate}`);
  console.log(`   - 对账状态: ${reconcileResult.matchedRecords}/${reconcileResult.totalFactRecords} 已匹配`);
  console.log(`   - 验证金额: ¥${reconcileResult.totalVerifiedAmount.toFixed(2)}`);
  console.log(`   - 账单金额: ¥${reconcileResult.totalBilledAmount.toFixed(2)}`);
  console.log(`   - 差额:     ¥${reconcileResult.discrepancy.toFixed(2)}`);

  await closeDatabase();
}

main().catch(console.error);
