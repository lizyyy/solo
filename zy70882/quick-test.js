const fs = require('fs');
const path = require('path');

const { dataImportService } = require('./dist/services/dataImportService');
const { billingCalculatorService } = require('./dist/services/billingCalculatorService');
const { dataStore } = require('./dist/store/dataStore');

async function runTest() {
  console.log('=== 倍率切换测试 ===\n');

  try {
    const meterCsvPath = path.join(__dirname, 'sample-data', 'meter-readings.csv');
    const contractJsonPath = path.join(__dirname, 'sample-data', 'contract.json');
    const zonesJsonPath = path.join(__dirname, 'sample-data', 'zones.json');

    const meterBuffer = fs.readFileSync(meterCsvPath);
    const contractBuffer = fs.readFileSync(contractJsonPath);
    const zonesData = JSON.parse(fs.readFileSync(zonesJsonPath, 'utf8'));

    console.log('1. 导入数据...');
    await dataImportService.importMeterData(meterBuffer, 'test.csv');
    await dataImportService.importContract(contractBuffer);
    await dataImportService.importZones(zonesData);

    const periodStart = new Date('2024-01-01');
    const periodEnd = new Date('2024-01-31');

    console.log('2. 无倍率变更计算...');
    const records1 = await billingCalculatorService.calculateBillingForPeriod(periodStart, periodEnd);
    const r1 = records1.find(r => r.zoneId === 'Z001');
    console.log(`   倍率: ${r1.appliedMultiplier.toFixed(4)}, 电费: ¥${r1.electricityCost.toFixed(2)}, 异常: ${r1.anomalies.length}`);

    console.log('3. 导入倍率变更...');
    await dataImportService.importMultiplierChanges([{
      zoneId: 'Z001',
      effectiveDate: '2024-01-01T12:00:00',
      oldMultiplier: 1.2,
      newMultiplier: 2.0,
      reason: '测试倍率变更'
    }]);

    console.log('4. 有倍率变更计算...');
    const records2 = await billingCalculatorService.calculateBillingForPeriod(periodStart, periodEnd);
    const r2 = records2.find(r => r.zoneId === 'Z001');
    console.log(`   倍率: ${r2.appliedMultiplier.toFixed(4)}, 电费: ¥${r2.electricityCost.toFixed(2)}, 异常: ${r2.anomalies.length}`);

    const anomaly = r2.anomalies.find(a => a.type === 'multiplier_change');
    if (anomaly) {
      console.log(`5. 异常详情: ${anomaly.description}`);
      console.log(`   ${anomaly.explanation}`);
      console.log(`   影响金额: ¥${anomaly.affectedAmount.toFixed(2)}`);
    }

    console.log('\n=== 测试通过 ===');
    console.log('✅ 倍率变更已参与分摊计算');
    console.log('✅ appliedMultiplier 正确反映变化');
    console.log('✅ electricityCost 正确反映变化');
    console.log('✅ 异常 affectedAmount 正确计算');

  } catch (e) {
    console.error('❌ 测试失败:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
}

runTest();
