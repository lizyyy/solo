const Database = require('./database');
const moment = require('moment');

async function seedData() {
  const db = new Database();

  console.log('开始生成样例数据...');

  const contract1 = await db.createContract({
    contract_no: 'CT2024001',
    vendor_name: '华维维修服务有限公司',
    vendor_id: 'V001',
    base_price: 150.00,
    overtime_rate: 1.5,
    repair_hours_limit: 4,
    effective_date: '2024-01-01',
    expiry_date: '2024-12-31',
    status: 'active'
  });

  const contract2 = await db.createContract({
    contract_no: 'CT2024002',
    vendor_name: '鑫宇机电维修',
    vendor_id: 'V002',
    base_price: 180.00,
    overtime_rate: 2.0,
    repair_hours_limit: 3,
    effective_date: '2024-02-01',
    expiry_date: '2024-12-31',
    status: 'active'
  });

  const contract3 = await db.createContract({
    contract_no: 'CT2024003',
    vendor_name: '恒通设备维护',
    vendor_id: 'V003',
    base_price: 120.00,
    overtime_rate: 1.3,
    repair_hours_limit: 5,
    effective_date: '2024-03-01',
    expiry_date: '2024-12-31',
    status: 'active'
  });

  console.log('已创建 3 份合同');

  const order1 = await db.createWorkOrder({
    order_no: 'WO20240501',
    contract_id: contract1.id,
    asset_name: '中央空调机组A',
    asset_id: 'AST001',
    fault_description: '制冷效果不佳，压缩机异常噪音',
    vendor_name: '华维维修服务有限公司',
    vendor_id: 'V001',
    assigned_worker: '张三',
    scheduled_at: moment().subtract(3, 'days').format(),
    status: 'pending',
    created_by: '调度员A'
  });

  const order2 = await db.createWorkOrder({
    order_no: 'WO20240502',
    contract_id: contract1.id,
    asset_name: '电梯1号',
    asset_id: 'AST002',
    fault_description: '楼层按钮失灵，门开关卡顿',
    vendor_name: '华维维修服务有限公司',
    vendor_id: 'V001',
    assigned_worker: '李四',
    scheduled_at: moment().subtract(5, 'days').format(),
    status: 'in_progress',
    created_by: '调度员A'
  });
  await db.updateWorkOrderStatus(order2.id, 'in_progress', '李四', '已到达现场开始维修');

  const order3 = await db.createWorkOrder({
    order_no: 'WO20240503',
    contract_id: contract2.id,
    asset_name: '发电机备用机组',
    asset_id: 'AST003',
    fault_description: '启动困难，润滑油泄漏',
    vendor_name: '鑫宇机电维修',
    vendor_id: 'V002',
    assigned_worker: '王五',
    scheduled_at: moment().subtract(10, 'days').format(),
    arrived_at: moment().subtract(9, 'days').format(),
    completed_at: moment().subtract(7, 'days').format(),
    actual_hours: 5.5,
    base_amount: 180.00 * 3,
    overtime_amount: 180.00 * 2.0 * 2.5,
    deduction_amount: 500.00,
    total_amount: (180.00 * 3) + (180.00 * 2.0 * 2.5) - 500.00,
    status: 'completed',
    created_by: '调度员B',
    reviewed_by: '主管'
  });
  await db.updateWorkOrderStatus(order3.id, 'in_progress', '王五', '到达现场');
  await db.updateWorkOrderStatus(order3.id, 'completed', '王五', '维修完成');

  const order4 = await db.createWorkOrder({
    order_no: 'WO20240504',
    contract_id: contract1.id,
    asset_name: '消防水泵B',
    asset_id: 'AST004',
    fault_description: '泵体振动过大，密封泄漏',
    vendor_name: '华维维修服务有限公司',
    vendor_id: 'V001',
    assigned_worker: '张三',
    scheduled_at: moment().subtract(14, 'days').format(),
    arrived_at: moment().subtract(13, 'days').format(),
    completed_at: moment().subtract(12, 'days').format(),
    actual_hours: 3.5,
    base_amount: 150.00 * 3.5,
    overtime_amount: 0,
    deduction_amount: 0,
    total_amount: 150.00 * 3.5,
    status: 'reviewed',
    created_by: '调度员A',
    reviewed_by: '主管'
  });
  await db.updateWorkOrderStatus(order4.id, 'in_progress', '张三', '到达现场');
  await db.updateWorkOrderStatus(order4.id, 'completed', '张三', '维修完成');
  await db.updateWorkOrderStatus(order4.id, 'reviewed', '主管', '复核通过');

  const order5 = await db.createWorkOrder({
    order_no: 'WO20240505',
    contract_id: contract3.id,
    asset_name: '配电柜主开关',
    asset_id: 'AST005',
    fault_description: '接触不良，频繁跳闸',
    vendor_name: '恒通设备维护',
    vendor_id: 'V003',
    assigned_worker: '赵六',
    scheduled_at: moment().subtract(7, 'days').format(),
    arrived_at: moment().subtract(6, 'days').format(),
    actual_hours: 2,
    status: 'exception',
    created_by: '调度员C'
  });
  await db.updateWorkOrderStatus(order5.id, 'in_progress', '赵六', '到达现场');
  await db.updateWorkOrderStatus(order5.id, 'exception', '赵六', '发现备件不足，需延后处理');

  const order6 = await db.createWorkOrder({
    order_no: 'WO20240506',
    contract_id: contract1.id,
    asset_name: '电梯1号',
    asset_id: 'AST002',
    fault_description: '复修：门开关仍然卡顿',
    vendor_name: '华维维修服务有限公司',
    vendor_id: 'V001',
    assigned_worker: '李四',
    scheduled_at: moment().subtract(2, 'days').format(),
    status: 'pending',
    created_by: '调度员A'
  });

  const order7 = await db.createWorkOrder({
    order_no: 'WO20240507',
    contract_id: contract2.id,
    asset_name: '空调系统管道',
    asset_id: 'AST006',
    fault_description: '管道泄漏，制冷剂不足',
    vendor_name: '鑫宇机电维修',
    vendor_id: 'V002',
    assigned_worker: '王五',
    scheduled_at: moment().subtract(8, 'days').format(),
    arrived_at: moment().subtract(7, 'days').format(),
    completed_at: moment().subtract(6, 'days').format(),
    actual_hours: 6,
    base_amount: 180.00 * 3,
    overtime_amount: 180.00 * 2.0 * 3,
    deduction_amount: 300.00,
    total_amount: (180.00 * 3) + (180.00 * 2.0 * 3) - 300.00,
    status: 'completed',
    created_by: '调度员B'
  });
  await db.updateWorkOrderStatus(order7.id, 'in_progress', '王五', '到达现场');
  await db.updateWorkOrderStatus(order7.id, 'completed', '王五', '维修完成');

  console.log('已创建 7 份工单');

  await db.addArrivalPhoto({
    work_order_id: order2.id,
    photo_url: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=elevator%20repair%20work%20site%20with%20technician&image_size=square',
    photo_name: '电梯现场照片1.jpg',
    uploaded_by: '李四'
  });

  await db.addArrivalPhoto({
    work_order_id: order3.id,
    photo_url: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=generator%20repair%20workshop%20industrial&image_size=square',
    photo_name: '发电机维修现场.jpg',
    uploaded_by: '王五'
  });

  await db.addArrivalPhoto({
    work_order_id: order4.id,
    photo_url: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=fire%20pump%20maintenance%20industrial%20equipment&image_size=square',
    photo_name: '消防水泵现场.jpg',
    uploaded_by: '张三'
  });

  await db.addArrivalPhoto({
    work_order_id: order5.id,
    photo_url: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=electrical%20cabinet%20maintenance%20worker&image_size=square',
    photo_name: '配电柜现场.jpg',
    uploaded_by: '赵六'
  });

  await db.addArrivalPhoto({
    work_order_id: order7.id,
    photo_url: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=hvac%20air%20conditioning%20pipeline%20repair&image_size=square',
    photo_name: '空调管道维修.jpg',
    uploaded_by: '王五'
  });

  console.log('已添加 5 张到场照片');

  await db.createOvertimeDeduction({
    work_order_id: order3.id,
    overtime_hours: 2.5,
    overtime_rate: 2.0,
    deduction_amount: 500.00,
    deduction_reason: '超时2.5小时，按照合同条款扣款',
    verified_by: '主管'
  });

  await db.createOvertimeDeduction({
    work_order_id: order7.id,
    overtime_hours: 3.0,
    overtime_rate: 2.0,
    deduction_amount: 300.00,
    deduction_reason: '超时3小时，质量问题额外扣款',
    verified_by: '主管'
  });

  console.log('已创建 2 条超时扣款记录');

  await db.createEvidenceMissing({
    work_order_id: order3.id,
    missing_type: '维修记录',
    description: '缺少详细的维修过程记录单',
    severity: 'medium',
    responsible_person: '王五',
    status: 'resolved'
  });

  await db.createEvidenceMissing({
    work_order_id: order5.id,
    missing_type: '现场照片',
    description: '缺少故障点的特写照片',
    severity: 'high',
    responsible_person: '赵六',
    status: 'pending'
  });

  await db.createEvidenceMissing({
    work_order_id: order7.id,
    missing_type: '测试报告',
    description: '缺少压力测试和泄漏检测报告',
    severity: 'medium',
    responsible_person: '王五',
    status: 'pending'
  });

  console.log('已创建 3 条证据缺失记录');

  await db.createReworkRelation({
    original_work_order_id: order2.id,
    rework_work_order_id: order6.id,
    relation_type: 'rework',
    reason: '门开关问题未彻底解决，需要复修',
    created_by: '调度员A'
  });

  console.log('已创建 1 条复修关联');

  const bill1 = await db.createOutsourcingBill({
    bill_no: 'BILL20240501',
    contract_id: contract1.id,
    work_order_ids: [order4.id],
    vendor_name: '华维维修服务有限公司',
    vendor_id: 'V001',
    base_total: 150.00 * 3.5,
    overtime_total: 0,
    deduction_total: 0,
    final_amount: 150.00 * 3.5,
    status: 'approved',
    created_by: '财务A',
    approved_by: '财务主管'
  });

  const bill2 = await db.createOutsourcingBill({
    bill_no: 'BILL20240502',
    contract_id: contract2.id,
    work_order_ids: [order3.id, order7.id],
    vendor_name: '鑫宇机电维修',
    vendor_id: 'V002',
    base_total: (180.00 * 3) + (180.00 * 3),
    overtime_total: (180.00 * 2.0 * 2.5) + (180.00 * 2.0 * 3),
    deduction_total: 500.00 + 300.00,
    final_amount: ((180.00 * 3) + (180.00 * 2.0 * 2.5) - 500.00) + ((180.00 * 3) + (180.00 * 2.0 * 3) - 300.00),
    status: 'submitted',
    created_by: '财务A'
  });

  const bill3 = await db.createOutsourcingBill({
    bill_no: 'BILL20240503',
    contract_id: contract3.id,
    work_order_ids: [order5.id],
    vendor_name: '恒通设备维护',
    vendor_id: 'V003',
    base_total: 0,
    overtime_total: 0,
    deduction_total: 0,
    final_amount: 0,
    status: 'draft',
    created_by: '财务B'
  });

  console.log('已创建 3 份外包账单');

  await db.updateContract(contract1.id, {
    overtime_rate: 1.8
  }, '管理员', '根据新的合作协议调整超时费率');

  await db.updateWorkOrder(order4.id, {
    actual_hours: 4.0,
    base_amount: 600.00,
    total_amount: 600.00
  }, '调度员A', '补录实际工时');

  console.log('已添加修改历史记录');

  console.log('=== 样例数据生成完成 ===');
  console.log('合同:', 3, '份');
  console.log('工单:', 7, '份');
  console.log('到场照片:', 5, '张');
  console.log('超时扣款:', 2, '条');
  console.log('证据缺失:', 3, '条');
  console.log('复修关联:', 1, '条');
  console.log('外包账单:', 3, '份');
  console.log('');
  console.log('覆盖场景:');
  console.log('  - 成功工单 (WO20240504)');
  console.log('  - 异常工单 (WO20240505)');
  console.log('  - 复核工单 (WO20240504)');
  console.log('  - 复修关联 (WO20240502 -> WO20240506)');
  console.log('  - 超时扣款 (WO20240503, WO20240507)');
  console.log('  - 证据缺失留痕 (WO20240503, WO20240505, WO20240507)');
  console.log('  - 外包账单 (BILL20240501, BILL20240502, BILL20240503)');
  console.log('  - 合同单价修改历史');
  console.log('  - 到场照片和工时修改历史');

  process.exit(0);
}

seedData().catch(err => {
  console.error('生成数据失败:', err);
  process.exit(1);
});
