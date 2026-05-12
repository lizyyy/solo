const http = require('http');
const dbManager = require('../db/database');
const ReplacementApplication = require('../models/ReplacementApplication');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const Device = require('../models/Device');
const ReplacementService = require('../services/ReplacementService');
const FaultAuditService = require('../services/FaultAuditService');
const InventoryService = require('../services/InventoryService');
const ShipmentService = require('../services/ShipmentService');
const RecycleService = require('../services/RecycleService');
const WarrantyService = require('../services/WarrantyService');
const StatusHistoryService = require('../services/StatusHistoryService');
const OperationLogService = require('../services/OperationLogService');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');

function logSection(title) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(60)}\n`);
}

function logStep(step, desc) {
  console.log(`  [步骤 ${step}] ${desc}`);
}

function logResult(title, data) {
  console.log(`\n  ✅ ${title}`);
  console.log(`     ${JSON.stringify(data, null, 2).split('\n').join('\n     ')}`);
}

function logError(msg) {
  console.log(`\n  ❌ ${msg}`);
}

async function demoNormalFlow() {
  logSection('场景一: 正常换新流程 (张三)');
  
  const customers = Customer.findAll();
  const products = Product.findAll();
  
  const customer = customers.find(c => c.name === '张三');
  const productPhone = products.find(p => p.sku === 'PHONE-001');
  const devices = Device.findAll();
  const oldDevice = devices.find(d => d.current_owner_id === customer.id && d.is_new === 0);

  logStep(1, `创建换新申请`);
  const createResult = ReplacementService.createApplication({
    customer_id: customer.id,
    original_device_id: oldDevice.id,
    target_product_id: productPhone.id,
    replacement_reason: '屏幕碎裂，无法正常使用',
    application_source: 'CUSTOMER'
  }, '客服小明');
  
  if (createResult.isDuplicate) {
    logError('创建失败: 已有进行中的申请');
    return;
  }
  
  const appId = createResult.application.id;
  logResult('申请创建成功', {
    application_no: createResult.application.application_no,
    status: createResult.application.status,
    原机SN: oldDevice.sn
  });

  logStep(2, '提交故障审核（通过）');
  const auditResult = FaultAuditService.submitFaultAudit(appId, {
    approved: true,
    fault_description: '屏幕碎裂，触控失灵',
    fault_type: 'SCREEN_DAMAGE',
    audit_notes: '经检测确认为硬件故障，符合换新条件'
  }, '工程师老王');
  
  logResult('故障审核通过', {
    audit_result: auditResult.audit.audit_result,
    确认换新: auditResult.audit.confirm_need_replacement === 1 ? '是' : '否',
    application_status: auditResult.application.status
  });

  logStep(3, '分配库存');
  const inventoryResult = InventoryService.allocateInventory(appId, '仓库管理员小李');
  
  if (inventoryResult.inventory_shortage) {
    logError('库存不足！');
    return;
  }
  
  logResult('库存分配成功', {
    新机SN: inventoryResult.device.sn,
    分配状态: inventoryResult.allocation.allocation_status,
    application_status: inventoryResult.application.status
  });

  logStep(4, '发货');
  const shipResult = ShipmentService.createShipment(appId, {
    tracking_no: 'SF1234567890',
    shipping_company: '顺丰速运',
    shipping_address: customer.address
  }, '仓库管理员小李');
  
  logResult('发货成功', {
    运单号: shipResult.shipment.tracking_no,
    物流公司: shipResult.shipment.shipping_company,
    application_status: shipResult.application.status
  });

  logStep(5, '确认收货');
  const deliverResult = ShipmentService.confirmDelivery(appId, {
    delivered_at: new Date().toISOString()
  }, '客服小明');
  
  logResult('确认收货', {
    发货状态: deliverResult.shipment.status,
    application_status: deliverResult.application.status
  });

  logStep(6, '启动原机回收');
  const recycleStartResult = RecycleService.startRecycleProcess(appId, {
    recycle_tracking_no: 'YT9876543210',
    recycle_company: '圆通速递',
    expected_receive_date: dayjs().add(7, 'day').format('YYYY-MM-DD')
  }, '回收专员小陈');
  
  logResult('回收启动成功', {
    回收单号: recycleStartResult.recycleRecord.recycle_tracking_no,
    预计回收日期: recycleStartResult.recycleRecord.expected_receive_date,
    application_status: recycleStartResult.application.status
  });

  logStep(7, '确认收到原机');
  const receiveResult = RecycleService.confirmReceive(appId, {
    actual_receive_date: new Date().toISOString()
  }, '质检师小周');
  
  logResult('原机已收到', {
    实际收到日期: receiveResult.recycleRecord.actual_receive_date,
    application_status: receiveResult.application.status
  });

  logStep(8, '原机检验完成');
  const inspectResult = RecycleService.completeInspection(appId, {
    inspection_notes: '原机外观有磨损，功能正常，已入库作为翻新机'
  }, '质检师小周');
  
  logResult('原机检验完成', {
    检验备注: inspectResult.recycleRecord.inspection_notes,
    application_status: inspectResult.application.status
  });

  logStep(9, '重新计算保修期');
  const warrantyResult = WarrantyService.recalculateWarranty(appId, {
    mode: 'inherit',
    notes: '继承原机剩余保修期'
  }, '售后专员小吴');
  
  logResult('保修期计算完成', {
    计算模式: warrantyResult.warranty.calculation_mode,
    原保修期结束: warrantyResult.warranty.original_warranty_end,
    新保修期结束: warrantyResult.warranty.new_warranty_end,
    application_status: warrantyResult.application.status
  });

  logStep(10, '查看最终状态');
  const relationReport = ReplacementService.getDeviceRelationReport(appId);
  
  logResult('换新流程闭环完成', {
    申请单号: relationReport.application_no,
    客户: relationReport.customer.name,
    原机SN: relationReport.original_device.sn,
    新机SN: relationReport.new_device.sn,
    状态: relationReport.application_status,
    完成: relationReport.completed ? '是' : '否'
  });

  return appId;
}

async function demoInventoryShortage() {
  logSection('场景二: 库存不足流程 (李四)');
  
  const customers = Customer.findAll();
  const products = Product.findAll();
  
  const customer = customers.find(c => c.name === '李四');
  const productTablet = products.find(p => p.sku === 'TABLET-001');
  const devices = Device.findAll();
  const oldDevice = devices.find(d => d.current_owner_id === customer.id && d.is_new === 0);

  logStep(1, '创建换新申请（目标产品无库存）');
  const createResult = ReplacementService.createApplication({
    customer_id: customer.id,
    original_device_id: oldDevice.id,
    target_product_id: productTablet.id,
    replacement_reason: '系统卡顿，需要换新平板',
    application_source: 'CUSTOMER'
  }, '客服小明');
  
  const appId = createResult.application.id;
  logResult('申请创建成功', {
    application_no: createResult.application.application_no,
    目标产品: productTablet.name
  });

  logStep(2, '提交故障审核（通过）');
  FaultAuditService.submitFaultAudit(appId, {
    approved: true,
    fault_description: '系统卡顿频繁',
    fault_type: 'SOFTWARE_ISSUE',
    audit_notes: '经检测确认为需要换新'
  }, '工程师老王');

  logStep(3, '尝试分配库存（应该失败）');
  
  try {
    const inventoryResult = InventoryService.allocateInventory(appId, '仓库管理员小李');
    if (inventoryResult.inventory_shortage) {
      logResult('库存不足', {
        状态: '库存不足，无法分配',
        application_status: inventoryResult.application.status
      });
    } else {
      logError('预期应该库存不足，但分配成功了');
    }
  } catch (e) {
    logResult('库存不足异常', {
      error: e.message
    });
  }

  logStep(4, '查看风险报告');
  const riskReport = ReplacementService.getRiskReport();
  
  logResult('风险报告（库存不足）', {
    库存不足数量: riskReport.summary.inventory_shortage_count,
    详情: riskReport.risks.inventory_shortage.map(r => ({
      申请单号: r.application_no,
      客户: r.customer_name,
      目标产品: r.target_product
    }))
  });

  return appId;
}

async function demoOverdueRecycle() {
  logSection('场景三: 原机逾期流程 (王五)');
  
  const customers = Customer.findAll();
  const products = Product.findAll();
  
  const customer = customers.find(c => c.name === '王五');
  const productPhone = products.find(p => p.sku === 'PHONE-001');
  const devices = Device.findAll();
  const oldDevice = devices.find(d => d.current_owner_id === customer.id && d.is_new === 0);

  logStep(1, '创建换新申请');
  const createResult = ReplacementService.createApplication({
    customer_id: customer.id,
    original_device_id: oldDevice.id,
    target_product_id: productPhone.id,
    replacement_reason: '电池鼓包，存在安全隐患',
    application_source: 'CUSTOMER'
  }, '客服小明');
  
  const appId = createResult.application.id;

  logStep(2, '故障审核通过');
  FaultAuditService.submitFaultAudit(appId, {
    approved: true,
    fault_description: '电池鼓包',
    fault_type: 'BATTERY_ISSUE',
    audit_notes: '电池存在安全隐患，必须换新'
  }, '工程师老王');

  logStep(3, '分配库存并发货');
  InventoryService.allocateInventory(appId, '仓库管理员小李');
  ShipmentService.createShipment(appId, {
    tracking_no: 'SF1111111111',
    shipping_company: '顺丰速运',
    shipping_address: customer.address
  }, '仓库管理员小李');
  ShipmentService.confirmDelivery(appId, {}, '客服小明');

  logStep(4, '启动回收，设置预计日期为过去日期（模拟逾期）');
  RecycleService.startRecycleProcess(appId, {
    recycle_tracking_no: 'YT2222222222',
    recycle_company: '圆通速递',
    expected_receive_date: dayjs().subtract(3, 'day').format('YYYY-MM-DD')
  }, '回收专员小陈');

  logStep(5, '检查逾期回收');
  const overdueResult = RecycleService.checkOverdue();
  
  logResult('逾期检测结果', {
    处理的逾期单数: overdueResult.length,
    详情: overdueResult
  });

  logStep(6, '查看风险报告');
  const riskReport = ReplacementService.getRiskReport();
  
  logResult('风险报告（回收逾期）', {
    回收逾期数量: riskReport.summary.recycle_overdue_count,
    详情: riskReport.risks.recycle_overdue.map(r => ({
      申请单号: r.application_no,
      客户: r.customer_name,
      预计回收日期: r.expected_receive_date,
      当前状态: r.status
    }))
  });

  const app = ReplacementApplication.findById(appId);
  logResult('申请单当前状态', {
    申请单号: app.application_no,
    状态: app.status
  });

  return appId;
}

async function demoDuplicateApplication() {
  logSection('场景四: 重复申请流程 (赵六)');
  
  const customers = Customer.findAll();
  const products = Product.findAll();
  
  const customer = customers.find(c => c.name === '赵六');
  const productPhone = products.find(p => p.sku === 'PHONE-001');
  const devices = Device.findAll();
  const oldDevice = devices.find(d => d.current_owner_id === customer.id && d.is_new === 0);

  logStep(1, '第一次申请（应该成功）');
  const result1 = ReplacementService.createApplication({
    customer_id: customer.id,
    original_device_id: oldDevice.id,
    target_product_id: productPhone.id,
    replacement_reason: '主板故障，无法开机',
    application_source: 'CUSTOMER'
  }, '客服小明');
  
  logResult('第一次申请', {
    是否重复: result1.isDuplicate ? '是' : '否',
    申请单号: result1.application.application_no,
    状态: result1.application.status
  });

  logStep(2, '同一设备第二次申请（应该检测为重复）');
  const result2 = ReplacementService.createApplication({
    customer_id: customer.id,
    original_device_id: oldDevice.id,
    target_product_id: productPhone.id,
    replacement_reason: '主板故障，无法开机（重复申请）',
    application_source: 'CUSTOMER'
  }, '客服小红');
  
  logResult('第二次申请（重复检测）', {
    是否重复: result2.isDuplicate ? '是' : '否',
    提示信息: result2.message,
    已存在的申请单号: result2.application.application_no
  });

  logStep(3, '查看状态历史');
  const history = StatusHistoryService.getHistory(result1.application.id);
  
  logResult('状态历史', {
    历史记录数: history.length,
    详情: history.map(h => ({
      模块: h.module,
      旧状态: h.old_status,
      新状态: h.new_status,
      原因: h.reason,
      时间: h.created_at
    }))
  });

  logStep(4, '查看操作日志');
  const logs = OperationLogService.getLogsByApplication(result1.application.id);
  
  logResult('操作日志', {
    日志数量: logs.length,
    详情: logs.map(l => ({
      操作类型: l.operation_type,
      操作者: l.operator,
      原因: l.reason,
      差异: l.diff_summary
    }))
  });

  return result1.application.id;
}

async function runAllDemos() {
  await dbManager.initialize();

  console.log('\n' + '*'.repeat(70));
  console.log('*' + ' '.repeat(68) + '*');
  console.log('*' + '  售后换新库存 API - 完整演示流程'.padEnd(68) + '*');
  console.log('*' + ' '.repeat(68) + '*');
  console.log('*'.repeat(70));

  try {
    const app1 = await demoNormalFlow();
    const app2 = await demoInventoryShortage();
    const app3 = await demoOverdueRecycle();
    const app4 = await demoDuplicateApplication();

    logSection('演示完成 - 最终统计');

    const stats = ReplacementService.getStatistics();
    logResult('系统统计', {
      总申请数: stats.total,
      各状态数量: stats.by_status,
      风险摘要: stats.risk_summary
    });

    const riskReport = ReplacementService.getRiskReport();
    logResult('风险汇总报告', {
      生成时间: riskReport.generated_at,
      回收逾期: riskReport.summary.recycle_overdue_count,
      库存不足: riskReport.summary.inventory_shortage_count,
      等待回收: riskReport.summary.awaiting_recycle_count
    });

    console.log('\n' + '*'.repeat(70));
    console.log('*' + '  演示完成！所有场景已执行完毕'.padEnd(68) + '*');
    console.log('*'.repeat(70));
    console.log('\n您可以通过以下方式查看详情:');
    console.log('  - 正常换新申请: GET /api/replacements/' + app1);
    console.log('  - 库存不足申请: GET /api/replacements/' + app2);
    console.log('  - 回收逾期申请: GET /api/replacements/' + app3);
    console.log('  - 重复申请: GET /api/replacements/' + app4);
    console.log('  - 风险报告: GET /api/replacements/risk-report');
    console.log('  - 设备关系: GET /api/replacements/:id/relation');
    console.log('  - 状态历史: GET /api/replacements/:id/history');
    console.log('  - 操作日志: GET /api/replacements/:id/logs');
    console.log('\n');

  } catch (error) {
    console.error('\n演示过程中发生错误:', error);
    console.error(error.stack);
  } finally {
    dbManager.close();
  }
}

if (require.main === module) {
  runAllDemos();
}

module.exports = {
  demoNormalFlow,
  demoInventoryShortage,
  demoOverdueRecycle,
  demoDuplicateApplication
};
