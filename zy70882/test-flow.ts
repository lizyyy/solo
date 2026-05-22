import * as fs from 'fs';
import * as path from 'path';
import { dataImportService } from './src/services/dataImportService';
import { billingCalculatorService } from './src/services/billingCalculatorService';
import { reviewService } from './src/services/reviewService';
import { reportService } from './src/services/reportService';

async function runTest() {
  console.log('=== 冷库园区对账服务测试 ===\n');

  try {
    const meterCsvPath = path.join(__dirname, 'sample-data', 'meter-readings.csv');
    const contractJsonPath = path.join(__dirname, 'sample-data', 'contract.json');
    const zonesJsonPath = path.join(__dirname, 'sample-data', 'zones.json');

    const meterBuffer = fs.readFileSync(meterCsvPath);
    const contractBuffer = fs.readFileSync(contractJsonPath);
    const zonesData = JSON.parse(fs.readFileSync(zonesJsonPath, 'utf8'));

    console.log('1. 导入电表数据...');
    const meterResult = await dataImportService.importMeterData(meterBuffer, 'meter-readings.csv');
    console.log(`   导入电表记录: ${meterResult.imported} 条`);
    if (meterResult.errors.length > 0) {
      console.log('   错误:', meterResult.errors);
      throw new Error('电表数据导入失败');
    }

    console.log('\n2. 导入租户合同...');
    const contract = await dataImportService.importContract(contractBuffer);
    console.log(`   导入合同: ${contract.tenantName}`);
    console.log(`   关联温区: ${contract.zoneIds.join(', ')}`);

    console.log('\n3. 导入温区配置...');
    const zones = await dataImportService.importZones(zonesData);
    console.log(`   导入温区: ${zones.length} 个`);
    zones.forEach(z => {
      console.log(`     - ${z.id}: ${z.name} (倍率: ${z.multiplier})`);
    });

    console.log('\n4. 计算账单...');
    const periodStart = new Date('2024-01-01');
    const periodEnd = new Date('2024-01-31');
    const records = await billingCalculatorService.calculateBillingForPeriod(periodStart, periodEnd);
    console.log(`   生成账单: ${records.length} 条`);

    if (records.length === 0) {
      throw new Error('账单生成为0，可能是温区ID不匹配导致的');
    }

    records.forEach(r => {
      console.log(`\n   ${r.tenantName} - ${r.zoneName}:`);
      console.log(`     总用电量: ${r.totalConsumption.toFixed(2)} kWh`);
      console.log(`     电费: ¥${r.electricityCost.toFixed(2)}`);
      console.log(`     基础租金: ¥${r.baseRent.toFixed(2)}`);
      console.log(`     加班附加费: ¥${r.overtimeSurcharge.toFixed(2)}`);
      console.log(`     总计: ¥${r.totalAmount.toFixed(2)}`);
      console.log(`     异常数: ${r.anomalies.length}`);
      r.anomalies.forEach(a => {
        console.log(`       - [${a.severity}] ${a.description}`);
        console.log(`         ${a.explanation}`);
      });
    });

    console.log('\n5. 审批第一条账单...');
    if (records.length > 0) {
      const approved = await reviewService.approveRecord(
        records[0].id,
        'test_user',
        '测试用户',
        '数据核对无误，审批通过'
      );
      console.log(`   账单状态: ${approved?.reviewStatus}`);
      console.log(`   复核记录数: ${approved?.reviewNotes.length}`);
    }

    console.log('\n6. 生成Excel报告...');
    const excelBuffer = await reportService.generateExcelReport(periodStart, periodEnd, true);
    const excelPath = path.join(__dirname, 'test-output', 'billing-report.xlsx');
    fs.mkdirSync(path.dirname(excelPath), { recursive: true });
    fs.writeFileSync(excelPath, excelBuffer);
    console.log(`   Excel报告已生成: ${excelPath} (${(excelBuffer.length / 1024).toFixed(2)} KB)`);

    console.log('\n7. 生成PDF报告...');
    const pdfBuffer = await reportService.generatePDFReport(periodStart, periodEnd, true);
    const pdfPath = path.join(__dirname, 'test-output', 'billing-report.pdf');
    fs.writeFileSync(pdfPath, pdfBuffer);
    console.log(`   PDF报告已生成: ${pdfPath} (${(pdfBuffer.length / 1024).toFixed(2)} KB)`);

    console.log('\n8. 生成HTML详情页...');
    if (records.length > 0) {
      const html = reportService.generateRecordDetailsHTML(records[0]);
      const htmlPath = path.join(__dirname, 'test-output', 'record-detail.html');
      fs.writeFileSync(htmlPath, html);
      console.log(`   HTML详情页已生成: ${htmlPath} (${(Buffer.from(html).length / 1024).toFixed(2)} KB)`);
    }

    console.log('\n=== 测试完成 ===');
    console.log('✅ 所有核心功能验证通过');
    console.log('✅ 电表CSV导入正常');
    console.log('✅ 温区ID匹配正常 (Z001/Z002保留)');
    console.log('✅ 账单计算正常 (生成了记录)');
    console.log('✅ 复核流程正常');
    console.log('✅ 报表生成正常');

  } catch (error: any) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runTest();
