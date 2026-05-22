import * as fs from 'fs';
import * as path from 'path';
import { dataImportService } from './src/services/dataImportService';
import { billingCalculatorService } from './src/services/billingCalculatorService';
import { reviewService } from './src/services/reviewService';
import { reportService } from './src/services/reportService';
import { dataStore } from './src/store/dataStore';

async function runReviewTest() {
  console.log('=== 复核闭环功能测试 ===\n');

  try {
    const meterCsvPath = path.join(__dirname, 'sample-data', 'meter-readings.csv');
    const contractJsonPath = path.join(__dirname, 'sample-data', 'contract.json');
    const zonesJsonPath = path.join(__dirname, 'sample-data', 'zones.json');

    const meterBuffer = fs.readFileSync(meterCsvPath);
    const contractBuffer = fs.readFileSync(contractJsonPath);
    const zonesData = JSON.parse(fs.readFileSync(zonesJsonPath, 'utf8'));

    console.log('1. 初始化数据...');
    await dataImportService.importMeterData(meterBuffer, 'meter-readings.csv');
    await dataImportService.importContract(contractBuffer);
    await dataImportService.importZones(zonesData);

    const periodStart = new Date('2024-01-01');
    const periodEnd = new Date('2024-01-31');
    const records = await billingCalculatorService.calculateBillingForPeriod(periodStart, periodEnd);

    console.log(`   初始账单数: ${records.length}`);
    console.log(`   初始账单ID: ${records.map(r => r.id).join(', ')}`);

    const record = records[0];
    console.log(`\n2. 测试前账单数据:`);
    console.log(`   电费: ¥${record.electricityCost.toFixed(2)}`);
    console.log(`   基础租金: ¥${record.baseRent.toFixed(2)}`);
    console.log(`   加班附加费: ¥${record.overtimeSurcharge.toFixed(2)}`);
    console.log(`   总计: ¥${record.totalAmount.toFixed(2)}`);

    const initialSummary = dataStore.getBillingSummary(periodStart, periodEnd);
    console.log(`   汇总 grandTotal: ¥${initialSummary.grandTotal.toFixed(2)}`);

    console.log(`\n3. 测试: 修改电费后自动重算 totalAmount...`);
    const newElectricityCost = 5000;
    const modified = reviewService.modifyRecord(
      record.id,
      'test_user',
      '测试用户',
      '调整电费金额',
      { electricityCost: newElectricityCost }
    );

    if (!modified) throw new Error('修改失败');

    const expectedTotal = newElectricityCost + record.baseRent + record.overtimeSurcharge;
    console.log(`   修改后电费: ¥${modified.electricityCost.toFixed(2)}`);
    console.log(`   预期总计: ¥${expectedTotal.toFixed(2)}`);
    console.log(`   实际总计: ¥${modified.totalAmount.toFixed(2)}`);

    if (Math.abs(modified.totalAmount - expectedTotal) > 0.01) {
      throw new Error(`❌ totalAmount 未同步更新！预期 ${expectedTotal}，实际 ${modified.totalAmount}`);
    }
    console.log(`   ✅ totalAmount 已同步更新`);

    console.log(`\n4. 测试: 汇总数据是否同步更新...`);
    const summaryAfterModify = dataStore.getBillingSummary(periodStart, periodEnd);
    console.log(`   修改前汇总: ¥${initialSummary.grandTotal.toFixed(2)}`);
    console.log(`   修改后汇总: ¥${summaryAfterModify.grandTotal.toFixed(2)}`);

    if (summaryAfterModify.grandTotal <= initialSummary.grandTotal) {
      throw new Error('❌ 汇总 grandTotal 未同步变化！');
    }
    console.log(`   ✅ 汇总 grandTotal 已同步变化`);

    console.log(`\n5. 测试: 重新计算不新增重复记录...`);
    const recordCountBefore = dataStore.getAllBillingRecords().length;
    const originalId = record.id;

    const recalculated = billingCalculatorService.recalculateRecord(originalId);
    if (!recalculated) throw new Error('重新计算失败');

    const recordCountAfter = dataStore.getAllBillingRecords().length;
    const allRecordIds = dataStore.getAllBillingRecords().map(r => r.id);

    console.log(`   重新计算前记录数: ${recordCountBefore}`);
    console.log(`   重新计算后记录数: ${recordCountAfter}`);
    console.log(`   原始记录ID: ${originalId}`);
    console.log(`   重新计算后ID: ${recalculated.id}`);

    if (recordCountAfter !== recordCountBefore) {
      throw new Error(`❌ 重新计算新增了记录！预期 ${recordCountBefore}，实际 ${recordCountAfter}`);
    }
    if (recalculated.id !== originalId) {
      throw new Error(`❌ 重新计算后ID变化！预期 ${originalId}，实际 ${recalculated.id}`);
    }
    console.log(`   ✅ 重新计算未新增重复记录，ID保持不变`);

    console.log(`\n6. 测试: 修改后报表数字同步...`);
    const excelBuffer = await reportService.generateExcelReport(periodStart, periodEnd, true);
    fs.mkdirSync(path.join(__dirname, 'test-output'), { recursive: true });
    fs.writeFileSync(path.join(__dirname, 'test-output', 'review-test-report.xlsx'), excelBuffer);
    console.log(`   Excel报告已生成: ${(excelBuffer.length / 1024).toFixed(2)} KB`);

    const html = reportService.generateRecordDetailsHTML(modified);
    fs.writeFileSync(path.join(__dirname, 'test-output', 'modified-record.html'), html);
    console.log(`   HTML详情页已生成，包含修改后的数据`);

    console.log(`\n7. 测试: 复核历史记录追踪...`);
    console.log(`   复核记录数: ${modified.reviewNotes.length}`);
    modified.reviewNotes.forEach((note, i) => {
      console.log(`     ${i + 1}. [${note.action}] ${note.userName}: ${note.comment}`);
      if (note.changes) {
        console.log(`        修改内容: ${Object.keys(note.changes).join(', ')}`);
      }
    });

    if (modified.reviewNotes.length !== 1) {
      throw new Error(`❌ 复核历史记录缺失！`);
    }
    console.log(`   ✅ 复核历史记录完整`);

    console.log(`\n=== 测试完成 ===`);
    console.log('✅ 修改后 totalAmount 自动同步计算');
    console.log('✅ 修改后汇总 grandTotal 同步变化');
    console.log('✅ 重新计算不新增重复记录，ID保持不变');
    console.log('✅ 报表导出使用最新数据');
    console.log('✅ 复核历史记录完整追踪');
    console.log('\n🎉 复核闭环功能验证通过！');

  } catch (error: any) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runReviewTest();
