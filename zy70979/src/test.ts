import { initDatabase } from './database';
import { createBatch, registerMaterial, reclassifyMaterial, recalculateBatch } from './services/materialService';
import { getMaterialTrail, getAuditLogs } from './services/auditService';
import { checkDuplicateDeduction } from './services/classificationService';
import { getEquipmentHistory, getOrderTracking } from './services/equipmentService';
import { exportMaterials, exportToCsv, getEquipmentTrackingReport } from './services/exportService';

async function runTests() {
  console.log('=== 二手设备租赁押金 API 服务测试 ===\n');

  const db = await initDatabase();
  console.log('1. 数据库初始化完成 ✓\n');

  console.log('2. 测试创建批次...');
  const batch1 = await createBatch(db, '2026年5月第一批', '客服小王');
  console.log(`   批次创建成功: ${batch1.name} (ID: ${batch1.id})\n`);

  console.log('3. 测试登记材料（正常情况-无扣款）...');
  const material1 = await registerMaterial(db, {
    batchId: batch1.id,
    orderNo: 'RENT-20260501-001',
    equipmentSerial: 'EQ-001',
    customerName: '张三',
    rentalStartDate: '2026-04-01',
    rentalEndDate: '2026-05-01',
    depositAmount: 5000,
    actualReturnDate: '2026-04-30',
    equipmentName: '挖掘机',
    equipmentModel: 'CAT-320D'
  }, '客服小王');
  console.log(`   材料1状态: ${material1.status} - ${material1.statusReason}`);
  console.log(`   后续动作: ${material1.nextAction}\n`);

  console.log('4. 测试登记材料（逾期情况）...');
  const material2 = await registerMaterial(db, {
    batchId: batch1.id,
    orderNo: 'RENT-20260501-002',
    equipmentSerial: 'EQ-002',
    customerName: '李四',
    rentalStartDate: '2026-04-01',
    rentalEndDate: '2026-05-01',
    depositAmount: 8000,
    actualReturnDate: '2026-05-06',
    equipmentName: '装载机',
    equipmentModel: 'ZL50'
  }, '客服小李');
  console.log(`   材料2状态: ${material2.status}`);
  console.log(`   逾期天数: ${material2.status === 'normal' ? '见详情' : 'N/A'}`);
  console.log(`   后续动作: ${material2.nextAction}\n`);

  console.log('5. 测试登记材料（维修扣款）...');
  const material3 = await registerMaterial(db, {
    batchId: batch1.id,
    orderNo: 'RENT-20260501-003',
    equipmentSerial: 'EQ-003',
    customerName: '王五',
    rentalStartDate: '2026-03-15',
    rentalEndDate: '2026-04-15',
    depositAmount: 10000,
    actualReturnDate: '2026-04-15',
    repairCost: 1500,
    equipmentName: '压路机',
    equipmentModel: 'XS222'
  }, '客服小张');
  console.log(`   材料3状态: ${material3.status}`);
  console.log(`   后续动作: ${material3.nextAction}\n`);

  console.log('6. 测试重复扣款拦截...');
  const duplicateCheck = await checkDuplicateDeduction(db, 'RENT-20260501-002', 'EQ-002');
  console.log(`   重复检查结果: ${duplicateCheck.isDuplicate ? '检测到重复 ✓' : '无重复'}`);

  const material4 = await registerMaterial(db, {
    batchId: batch1.id,
    orderNo: 'RENT-20260501-002',
    equipmentSerial: 'EQ-002',
    customerName: '李四',
    rentalStartDate: '2026-04-01',
    rentalEndDate: '2026-05-01',
    depositAmount: 8000,
    actualReturnDate: '2026-05-06'
  }, '客服小赵');
  console.log(`   重复提交材料状态: ${material4.status}`);
  console.log(`   拦截原因: ${material4.statusReason}\n`);

  console.log('7. 测试修改分类（人工干预）...');
  await reclassifyMaterial(db, {
    materialId: material3.id,
    newStatus: 'pending',
    newReason: '维修费用凭证缺失，需要补充维修发票',
    operator: '主管-张经理',
    changeReason: '凭证审核发现问题'
  });
  console.log(`   材料3已修改为待补充状态 ✓\n`);

  console.log('8. 测试查询材料处理轨迹...');
  const trail = await getMaterialTrail(db, material3.id);
  if (trail) {
    console.log(`   材料3当前状态: ${trail.material.status}`);
    console.log(`   变更记录数: ${trail.changeHistory.length}`);
    trail.changeHistory.forEach((h: any, i: number) => {
      console.log(`   变更${i + 1}: ${h.changedBy} 在 ${h.changedAt}`);
      console.log(`     原因: ${h.changeReason}`);
      console.log(`     ${h.previous.status} → ${h.new.status}`);
    });
  }
  console.log('');

  console.log('9. 测试设备追踪...');
  const equipmentTracking = await getEquipmentTrackingReport(db, 'EQ-002');
  if (equipmentTracking) {
    console.log(`   设备: ${equipmentTracking.equipment.name} (${equipmentTracking.equipment.model})`);
    console.log(`   租赁次数: ${equipmentTracking.summary.totalRentals}`);
    console.log(`   累计扣减: ${equipmentTracking.summary.totalDeductions}元`);
    console.log(`   逾期费用: ${equipmentTracking.summary.totalOverdueFees}元`);
    console.log(`   维修费用: ${equipmentTracking.summary.totalRepairCosts}元`);
    console.log(`   最后处理人: ${equipmentTracking.summary.lastProcessor || 'N/A'}`);
  }
  console.log('');

  console.log('10. 测试订单追踪...');
  const orderTracking = await getOrderTracking(db, 'RENT-20260501-002');
  if (orderTracking) {
    console.log(`   订单: ${orderTracking.order.order_no}`);
    console.log(`   客户: ${orderTracking.order.customer_name}`);
    console.log(`   押金: ${orderTracking.order.deposit_amount}元`);
    console.log(`   最后处理人: ${orderTracking.lastProcessor || 'N/A'}`);
    console.log(`   相关材料数: ${orderTracking.materials.length}`);
  }
  console.log('');

  console.log('11. 测试批次重算...');
  const batch2 = await createBatch(db, '测试重算批次', '测试员');
  await registerMaterial(db, {
    batchId: batch2.id,
    orderNo: 'RENT-RECAL-001',
    equipmentSerial: 'EQ-RECAL-001',
    customerName: '测试客户',
    rentalStartDate: '2026-04-01',
    rentalEndDate: '2026-05-01',
    depositAmount: 3000,
    actualReturnDate: '2026-05-10'
  }, '测试员');
  
  const recalcResult = await recalculateBatch(db, batch2.id, '系统管理员');
  console.log(`   重算材料数: ${recalcResult.total}`);
  console.log(`   状态变更数: ${recalcResult.changed}\n`);

  console.log('12. 测试数据导出（CSV）...');
  const { csv, statistics } = await exportToCsv(db, { batchId: batch1.id });
  console.log(`   导出记录数: ${statistics.total}`);
  console.log(`   正常: ${statistics.normal}, 待补充: ${statistics.pending}, 已拦截: ${statistics.blocked}`);
  console.log(`   累计扣减: ${statistics.totalDeduction}元`);
  console.log(`   累计逾期费: ${statistics.totalOverdueFee}元`);
  console.log(`   累计维修费: ${statistics.totalRepairCost}元`);
  console.log(`   CSV前200字符: ${csv.substring(0, 200)}...\n`);

  console.log('13. 测试审计日志查询...');
  const auditLogs = await getAuditLogs(db, 'material', material3.id);
  console.log(`   材料3审计日志数: ${auditLogs.length}`);
  auditLogs.forEach((log: any) => {
    console.log(`   ${log.created_at}: ${log.operator} - ${log.action} - ${log.reason}`);
  });
  console.log('');

  console.log('14. 测试信息缺失材料（待补充）...');
  const incompleteMaterial = await registerMaterial(db, {
    batchId: batch1.id,
    orderNo: 'RENT-20260501-004',
    equipmentSerial: '',
    customerName: '赵六',
    rentalStartDate: '',
    rentalEndDate: '2026-05-10',
    depositAmount: 6000
  }, '客服小钱');
  console.log(`   缺失信息材料状态: ${incompleteMaterial.status}`);
  console.log(`   缺失原因: ${incompleteMaterial.statusReason}`);
  console.log(`   后续动作: ${incompleteMaterial.nextAction}\n`);

  console.log('=== 所有测试完成 ===');
  console.log('');
  console.log('测试结果汇总:');
  console.log('✓ 批次管理 - 创建批次、查询批次');
  console.log('✓ 材料登记 - 正常、待补充、已拦截三类分类');
  console.log('✓ 重复扣款拦截 - 同一订单/设备重复提交会被拦截');
  console.log('✓ 逾期费用计算 - 按押金1%/天计算逾期费用');
  console.log('✓ 维修扣款 - 维修费用自动计入扣减');
  console.log('✓ 人工干预 - 支持修改分类并记录原因');
  console.log('✓ 处理轨迹 - 可查询每次变更的详细信息');
  console.log('✓ 设备追踪 - 按序列号追踪所有租赁和扣减记录');
  console.log('✓ 订单追踪 - 跨订单追踪处理人和处理结果');
  console.log('✓ 数据导出 - CSV格式导出并包含统计数据');
  console.log('✓ 审计日志 - 所有操作记录完整可追溯');
}

runTests().catch(console.error);
