import assert from 'assert';
import { initDatabase, db } from '../src/database';
import * as services from '../src/services';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

async function runTest(name: string, testFn: () => Promise<void>) {
  console.log(`\n[测试] ${name}...`);
  try {
    await testFn();
    results.push({ name, passed: true });
    console.log(`  ✓ 通过`);
  } catch (error: any) {
    results.push({ name, passed: false, error: error.message });
    console.log(`  ✗ 失败: ${error.message}`);
  }
}

async function clearDatabase() {
  const tables = [
    'rental_accessories',
    'accessories',
    'return_inspections',
    'deposit_deductions',
    'manual_corrections',
    'exception_logs',
    'rental_orders',
    'equipment',
  ];
  
  for (const table of tables) {
    await new Promise<void>((resolve, reject) => {
      db.run(`DELETE FROM ${table}`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

async function main() {
  console.log('========================================');
  console.log('  影棚器材借还 API - 自检脚本启动');
  console.log('========================================');

  await initDatabase();
  await clearDatabase();

  await runTest('1. 创建器材 - 正常流程', async () => {
    const equipment = await services.createEquipment({
      name: '测试相机',
      category: '相机',
      model: 'Test-Model',
      serial_number: 'TEST-001',
      status: 'available',
      deposit_amount: 1000,
      daily_rate: 50,
      description: '测试用器材',
    });
    assert.ok(equipment.id, '器材ID不应为空');
    assert.strictEqual(equipment.name, '测试相机');
    assert.strictEqual(equipment.status, 'available');
  });

  let testEquipmentId = '';
  await runTest('2. 查询器材列表', async () => {
    const equipmentList = await services.getAllEquipment();
    assert.ok(Array.isArray(equipmentList));
    assert.ok(equipmentList.length > 0);
    testEquipmentId = equipmentList[0].id;
  });

  let testAccessoryIds: string[] = [];
  await runTest('3. 添加配件记录', async () => {
    await new Promise<void>((resolve, reject) => {
      db.run(
        `INSERT INTO accessories (id, equipment_id, name, quantity, status)
         VALUES (?, ?, ?, ?, 'good')`,
        ['acc-test-001', testEquipmentId, '测试电池', 2],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    testAccessoryIds.push('acc-test-001');
    
    const accessories = await services.getAccessories(testEquipmentId);
    assert.strictEqual(accessories.length, 1);
  });

  let testRentalOrderId = '';
  let testOrderNo = '';
  await runTest('4. 创建借用单 - 正常流程', async () => {
    const order = await services.createRentalOrder({
      equipment_id: testEquipmentId,
      borrower_name: '张三',
      borrower_phone: '13800138000',
      borrower_id: '320101199001011234',
      expected_start_date: '2024-01-15',
      expected_end_date: '2024-01-17',
      deposit_paid: 1000,
      notes: '测试借用',
      accessory_ids: testAccessoryIds,
    });
    testRentalOrderId = order.id;
    testOrderNo = order.order_no;
    assert.ok(order.id);
    assert.ok(order.order_no);
    assert.strictEqual(order.borrower_name, '张三');
    assert.strictEqual(order.status, 'pending');
  });

  await runTest('5. 重复借用同一器材 - 应失败', async () => {
    let errorThrown = false;
    try {
      await services.createRentalOrder({
        equipment_id: testEquipmentId,
        borrower_name: '李四',
        expected_start_date: '2024-01-15',
        expected_end_date: '2024-01-17',
        deposit_paid: 1000,
        accessory_ids: testAccessoryIds,
      });
    } catch (error) {
      errorThrown = true;
    }
    assert.strictEqual(errorThrown, true, '重复借用应抛出错误');
  });

  await runTest('6. 创建借用单 - 脏数据（缺少必填字段）', async () => {
    let errorThrown = false;
    try {
      await (services.createRentalOrder as any)({
        equipment_id: testEquipmentId,
      });
    } catch (error) {
      errorThrown = true;
    }
    assert.strictEqual(errorThrown, true);
  });

  await runTest('7. 状态流转校验 - pending → confirmed 合法', async () => {
    const isValid = services.validateStatusTransition('pending', 'confirmed');
    assert.strictEqual(isValid, true);
  });

  await runTest('8. 状态流转校验 - pending → returned 非法', async () => {
    const isValid = services.validateStatusTransition('pending', 'returned');
    assert.strictEqual(isValid, false);
  });

  await runTest('9. 更新借用单状态 - 非法状态跳转应失败', async () => {
    let errorThrown = false;
    try {
      await services.updateRentalOrderStatus(testRentalOrderId, 'returned');
    } catch (error: any) {
      errorThrown = true;
      assert.ok(error.message.includes('Invalid status transition'));
    }
    assert.strictEqual(errorThrown, true, '非法状态跳转应抛出错误');
  });

  await runTest('10. 更新借用单状态 - 确认借用', async () => {
    const order = await services.updateRentalOrderStatus(testRentalOrderId, 'confirmed');
    assert.strictEqual(order.status, 'confirmed');
  });

  await runTest('11. 更新借用单状态 - 开始使用', async () => {
    const order = await services.updateRentalOrderStatus(testRentalOrderId, 'active', '2024-01-15');
    assert.strictEqual(order.status, 'active');
    assert.strictEqual(order.actual_start_date, '2024-01-15');
  });

  await runTest('12. 归还检查前 - 配件应为不完整', async () => {
    const isComplete = await services.checkAccessoriesComplete(testRentalOrderId);
    assert.strictEqual(isComplete, false, '归还检查前配件应不完整');
  });

  await runTest('13. 创建归还检查 - 发现划痕并更新配件', async () => {
    await new Promise<void>((resolve, reject) => {
      db.run(
        `UPDATE rental_orders SET expected_end_date = '2024-01-18', actual_end_date = '2024-01-18' WHERE id = ?`,
        [testRentalOrderId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    
    const inspection = await services.createReturnInspection({
      rental_order_id: testRentalOrderId,
      inspector_name: '管理员A',
      has_scratches: true,
      scratches_description: '镜头边缘有轻微划痕',
      has_damage: false,
      accessories_complete: true,
      overall_condition: 'good',
      conclusion: '轻微划痕，需扣款200元',
    });
    assert.ok(inspection.id);
    assert.strictEqual(inspection.has_scratches, true);
  });

  await runTest('14. 归还检查后 - 配件应为完整', async () => {
    const isComplete = await services.checkAccessoriesComplete(testRentalOrderId);
    assert.strictEqual(isComplete, true, '归还检查后配件应标记为完整');
  });

  await runTest('15. 归还检查后 - 借用单状态应为returned', async () => {
    const order = await services.getRentalOrder(testRentalOrderId);
    assert.strictEqual(order?.status, 'returned');
  });

  await runTest('16. 归还检查后 - 配件归还数量应正确更新', async () => {
    const accessories = await services.getRentalAccessories(testRentalOrderId);
    assert.ok(accessories.length > 0);
    accessories.forEach(acc => {
      assert.strictEqual(acc.returned_quantity, acc.expected_quantity, '配件归还数量应等于预期数量');
      assert.strictEqual(acc.status, 'returned', '配件状态应为returned');
    });
  });

  let testDeductionId = '';
  await runTest('17. 创建押金扣款申请', async () => {
    const deduction = await services.createDepositDeduction({
      rental_order_id: testRentalOrderId,
      amount: 200,
      reason: '镜头划痕修复费用',
      requested_by: '管理员A',
      notes: '根据归还检查记录',
    });
    testDeductionId = deduction.id;
    assert.ok(deduction.id);
    assert.strictEqual(deduction.amount, 200);
    assert.strictEqual(deduction.status, 'pending');
  });

  await runTest('18. 审批扣款申请 - 批准', async () => {
    const deduction = await services.approveDepositDeduction(testDeductionId, '主管B', true);
    assert.strictEqual(deduction.status, 'approved');
    assert.strictEqual(deduction.approved_by, '主管B');
  });

  await runTest('19. 创建人工修正记录', async () => {
    await services.createManualCorrection({
      rental_order_id: testRentalOrderId,
      correction_type: 'amount_adjustment',
      field_name: 'deposit_paid',
      old_value: '1000',
      new_value: '1200',
      reason: '客户额外支付押金200元',
      corrected_by: '管理员A',
    });
  });

  let reportData: any = null;
  await runTest('20. 生成借还报告', async () => {
    await new Promise<void>((resolve, reject) => {
      db.run(
        `UPDATE rental_orders SET expected_end_date = '2024-01-18', actual_end_date = '2024-01-18' WHERE id = ?`,
        [testRentalOrderId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    
    const report = await services.generateRentalReport(testRentalOrderId);
    reportData = report;
    assert.strictEqual(report.order_no, testOrderNo);
    assert.strictEqual(report.borrower_name, '张三');
    assert.ok('rental_fee' in report);
    assert.ok('deductions' in report);
    assert.ok('deposit_refund' in report);
  });

  await runTest('21. 报告数据一致性验证', async () => {
    assert.ok(reportData);
    assert.strictEqual(reportData.deposit_paid, 1000);
    assert.ok(reportData.deductions >= 200, '扣款应包含划痕费用');
    assert.strictEqual(
      reportData.deposit_refund,
      reportData.deposit_paid - reportData.deductions
    );
  });

  let exceptionLogId = '';
  await runTest('22. 异常日志记录功能', async () => {
    exceptionLogId = await services.logException(
      'test_operation',
      { test: 'data' },
      'Test error message'
    );
    assert.ok(exceptionLogId);
  });

  await runTest('23. 查询异常日志', async () => {
    const logs = await services.getExceptionLogs();
    assert.ok(Array.isArray(logs));
    assert.ok(logs.length > 0);
  });

  await runTest('24. 更新异常日志 - 添加处理结论', async () => {
    await services.updateExceptionLog(
      exceptionLogId,
      '已通知用户并协商解决方案',
      '管理员A'
    );
    const log = await services.getExceptionLog(exceptionLogId);
    assert.ok(log);
    assert.strictEqual(log.processing_conclusion, '已通知用户并协商解决方案');
    assert.strictEqual(log.handled_by, '管理员A');
    assert.strictEqual(log.status, 'handled');
  });

  await runTest('25. 查询借用单配件清单', async () => {
    const accessories = await services.getRentalAccessories(testRentalOrderId);
    assert.ok(Array.isArray(accessories));
    assert.ok(accessories.length > 0);
  });

  await runTest('26. 逾期计费计算', async () => {
    const overdueDays = services.calculateOverdueDays('2024-01-17', '2024-01-20');
    assert.strictEqual(overdueDays, 3);
    
    const noOverdue = services.calculateOverdueDays('2024-01-17', '2024-01-17');
    assert.strictEqual(noOverdue, 0);
  });

  await runTest('27. 租金计算', async () => {
    const { days, fee } = services.calculateRentalFee(50, '2024-01-15', '2024-01-17');
    assert.strictEqual(days, 3);
    assert.strictEqual(fee, 150);
  });

  await runTest('28. 配件完整性检查', async () => {
    const isComplete = await services.checkAccessoriesComplete(testRentalOrderId);
    assert.strictEqual(isComplete, true);
  });

  await runTest('29. 借用单状态完成闭环', async () => {
    const order = await services.updateRentalOrderStatus(testRentalOrderId, 'completed');
    assert.strictEqual(order.status, 'completed');
  });

  console.log('\n========================================');
  console.log('  测试结果汇总');
  console.log('========================================');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`\n总测试数: ${results.length}`);
  console.log(`通过: ${passed} ✓`);
  console.log(`失败: ${failed} ✗`);
  
  if (failed > 0) {
    console.log('\n失败的测试:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 所有测试通过！');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('自检脚本执行失败:', err);
  process.exit(1);
});
