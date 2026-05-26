import * as path from 'path';
import { initDatabase } from '../database';
import * as importService from '../services/importService';

initDatabase();

const dataDir = path.join(process.cwd(), 'data');

async function initAll() {
  console.log('开始初始化数据...\n');

  const customerResult = await importService.importCustomersFromJson(
    path.join(dataDir, 'customers.json'),
    'system'
  );
  console.log('顾客档案导入:', customerResult);

  const medicineResult = await importService.importMedicinesFromJson(
    path.join(dataDir, 'medicines.json'),
    'system'
  );
  console.log('药品数据导入:', medicineResult);

  const ruleResult = await importService.importFollowUpRulesFromJson(
    path.join(dataDir, 'followUpRules.json'),
    'system'
  );
  console.log('随访规则导入:', ruleResult);

  const purchaseResult = await importService.importPurchaseRecordsFromCsv(
    path.join(dataDir, 'purchases.csv'),
    'system'
  );
  console.log('购药记录导入:', purchaseResult);

  console.log('\n数据初始化完成！');
}

initAll().catch(console.error);
