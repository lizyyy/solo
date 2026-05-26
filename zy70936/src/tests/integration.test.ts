import { test } from 'node:test';
import assert from 'node:assert';
import * as path from 'path';
import { initDatabase, getDb } from '../database';
import * as importService from '../services/importService';
import * as recordService from '../services/recordService';
import * as privacyService from '../services/privacyService';

const testDbPath = path.join(process.cwd(), 'test.db');
const dataDir = path.join(process.cwd(), 'data');

test('完整流程测试', async (t) => {
  initDatabase(testDbPath);
  const db = getDb();

  await t.test('1. 导入数据', async () => {
    const customerResult = await importService.importCustomersFromJson(
      path.join(dataDir, 'customers.json'),
      'test_operator'
    );
    assert.equal(customerResult.success, 4);
    assert.equal(customerResult.failed, 0);

    const medicineResult = await importService.importMedicinesFromJson(
      path.join(dataDir, 'medicines.json'),
      'test_operator'
    );
    assert.equal(medicineResult.success, 5);
    assert.equal(medicineResult.failed, 0);

    const ruleResult = await importService.importFollowUpRulesFromJson(
      path.join(dataDir, 'followUpRules.json'),
      'test_operator'
    );
    assert.equal(ruleResult.success, 3);
    assert.equal(ruleResult.failed, 0);

    const purchaseResult = await importService.importPurchaseRecordsFromCsv(
      path.join(dataDir, 'purchases.csv'),
      'test_operator'
    );
    assert.equal(purchaseResult.success, 8);
    assert.equal(purchaseResult.failed, 0);
  });

  await t.test('2. 隐私脱敏测试', () => {
    const maskedPhone = privacyService.maskPhone('13800138001');
    assert.equal(maskedPhone, '138****8001');

    const maskedIdCard = privacyService.maskIdCard('110101199001011234');
    assert.equal(maskedIdCard, '110101********1234');
  });

  await t.test('3. 获取待处理记录', () => {
    const pendingRecords = recordService.getPendingRecords();
    assert.equal(pendingRecords.length, 8);
  });

  await t.test('4. 审核通过记录（带间隔提醒）', () => {
    const pendingRecords = recordService.getPendingRecords();
    const intervalTestRecord = pendingRecords.find(r => (r as any).notes?.includes('间隔提醒'));
    assert.ok(intervalTestRecord);

    const processed = recordService.processRecord(
      intervalTestRecord.id,
      'approve',
      '已核实患者确实需要提前购药，医生已确认',
      'pharmacist_001',
      '间隔提醒：5天前刚购买过同类药品'
    );

    assert.equal(processed?.status, 'approved');
    assert.equal(processed?.processedBy, 'pharmacist_001');
    assert.ok(processed?.followUpDate);
  });

  await t.test('5. 退回修改记录（含禁忌药）', () => {
    const pendingRecords = recordService.getPendingRecords();
    const contraindicationRecord = pendingRecords.find(r => (r as any).notes?.includes('禁忌'));
    assert.ok(contraindicationRecord);

    const processed = recordService.processRecord(
      contraindicationRecord.id,
      'return',
      '患者为过敏体质，氯雷他定为禁忌症，需医生确认是否可以使用替代药物',
      'pharmacist_001',
      '请联系医生确认用药方案'
    );

    assert.equal(processed?.status, 'returned');
  });

  await t.test('6. 审核拒绝记录', () => {
    const pendingRecords = recordService.getPendingRecords();
    const recordToReject = pendingRecords[0];

    const processed = recordService.processRecord(
      recordToReject.id,
      'reject',
      '处方信息不完整，缺少医生签名',
      'pharmacist_001'
    );

    assert.equal(processed?.status, 'rejected');
  });

  await t.test('7. 按标签查询历史记录', () => {
    const records = recordService.queryRecords({
      customerTags: ['高血压']
    });
    assert.ok(records.length > 0);
    records.forEach(r => {
      const customer = db.prepare('SELECT tags FROM customers WHERE id = ?').get(r.customerId) as any;
      const tags = JSON.parse(customer.tags || '[]');
      assert.ok(tags.includes('高血压'));
    });
  });

  await t.test('8. 按药品分类查询', () => {
    const records = recordService.queryRecords({
      medicineCategories: ['心血管']
    });
    assert.ok(records.length > 0);
    records.forEach(r => {
      const medicine = db.prepare('SELECT category FROM medicines WHERE id = ?').get(r.medicineId) as any;
      assert.equal(medicine.category, '心血管');
    });
  });

  await t.test('9. 导出明细数量一致性', () => {
    const filter = { status: 'approved' as const };
    const queryResult = recordService.queryRecords(filter);
    const exportResult = recordService.exportRecords(filter);

    assert.equal(queryResult.length, exportResult.length);
    assert.ok(exportResult.length > 0);

    exportResult.forEach(record => {
      assert.ok(record.id);
      assert.ok(record.customerName);
      assert.ok(record.medicineName);
      assert.ok(record.purchaseDate);
    });
  });

  await t.test('10. 审计追踪验证', () => {
    const approvedRecords = recordService.queryRecords({ status: 'approved' });
    assert.ok(approvedRecords.length > 0);

    const auditTrail = recordService.getRecordWithAuditTrail(approvedRecords[0].id);
    assert.ok(auditTrail);
    assert.ok(auditTrail.processingHistory.length > 0);

    const history = auditTrail.processingHistory[0];
    assert.equal(history.action, '审核通过');
    assert.equal(history.operator, 'pharmacist_001');
    assert.ok(history.reason);
    assert.ok(history.time);
    assert.ok(history.details);
  });

  await t.test('11. 按状态查询', () => {
    const approvedRecords = recordService.queryRecords({ status: 'approved' });
    const rejectedRecords = recordService.queryRecords({ status: 'rejected' });
    const returnedRecords = recordService.queryRecords({ status: 'returned' });

    assert.ok(approvedRecords.length > 0);
    assert.ok(rejectedRecords.length > 0);
    assert.ok(returnedRecords.length > 0);
  });

  console.log('\n✅ 所有测试通过！');
});
