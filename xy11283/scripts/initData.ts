import fs from 'fs';
import path from 'path';
import '../src/database';
import * as importService from '../src/services/importService';
import * as prescriptionService from '../src/services/prescriptionService';
import * as inventoryService from '../src/services/inventoryService';

const dataDir = path.join(__dirname, '..', 'data');

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function initData() {
  console.log('开始初始化数据...\n');

  try {
    console.log('1. 导入药品数据...');
    const medicinesCsv = fs.readFileSync(path.join(dataDir, 'sample_medicines.csv'), 'utf-8');
    const medicinesResult = await importService.importMedicinesFromCsv(medicinesCsv);
    console.log(`   药品导入完成: 成功 ${medicinesResult.success} 条, 失败 ${medicinesResult.failed} 条\n`);

    await sleep(1000);

    console.log('2. 导入库存数据...');
    const inventoryCsv = fs.readFileSync(path.join(dataDir, 'sample_inventory.csv'), 'utf-8');
    const inventoryResult = await importService.importInventoryFromCsv(inventoryCsv);
    console.log(`   库存导入完成: 成功 ${inventoryResult.success} 条, 失败 ${inventoryResult.failed} 条\n`);

    await sleep(1000);

    console.log('3. 导入剂量规则...');
    const dosageCsv = fs.readFileSync(path.join(dataDir, 'sample_dosage.csv'), 'utf-8');
    const dosageResult = await importService.importDosageRulesFromCsv(dosageCsv);
    console.log(`   剂量规则导入完成: 成功 ${dosageResult.success} 条, 失败 ${dosageResult.failed} 条\n`);

    await sleep(1000);

    console.log('4. 导入处方数据...');
    const prescriptionsJson = fs.readFileSync(path.join(dataDir, 'sample_prescriptions.json'), 'utf-8');
    const prescriptionsResult = await importService.importPrescriptionsFromJson(prescriptionsJson);
    console.log(`   处方导入完成: 成功 ${prescriptionsResult.success} 条, 失败 ${prescriptionsResult.failed} 条\n`);

    await sleep(1000);

    console.log('5. 验证处方剂量...');
    const prescriptions = await prescriptionService.getAllPrescriptions();
    for (const presc of prescriptions.slice(0, 2)) {
      const result = await prescriptionService.validatePrescription(presc.id);
      console.log(`   处方 ${presc.prescription_no}: ${result.success ? '通过' : '未通过'}`);
    }

    await sleep(500);

    console.log('\n6. 发药测试...');
    const validatedPresc = await prescriptionService.getAllPrescriptions('validated');
    if (validatedPresc.length > 0) {
      const result = await prescriptionService.dispensePrescription(validatedPresc[0].id);
      console.log(`   处方 ${validatedPresc[0].prescription_no} 发药: ${result.success ? '成功' : '失败'}`);
    }

    await sleep(500);

    console.log('\n7. 库存汇总...');
    const summary = await inventoryService.getInventorySummary();
    summary.forEach((item: any) => {
      console.log(`   ${item.name}: ${item.total_quantity} ${item.unit} (${item.batch_count} 批次)`);
    });

    console.log('\n✅ 数据初始化完成!');
    console.log('\n下一步:');
    console.log('  npm install    # 安装依赖');
    console.log('  npm run build  # 编译项目');
    console.log('  npm start      # 启动服务器');
    console.log('\n访问 http://localhost:3000 查看API');

  } catch (error: any) {
    console.error('❌ 初始化失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

initData();
