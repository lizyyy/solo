console.log('\n' + '='.repeat(70));
console.log('检修备件最低库存 API - 正常流程演示');
console.log('='.repeat(70));

const initSchema = require('../config/schema');
initSchema();

const SparePart = require('../models/sparePart');
const Equipment = require('../models/equipment');
const PurchaseOrder = require('../models/purchaseOrder');
const MinStock = require('../models/minStock');
const AlternativePart = require('../models/alternativePart');
const alertService = require('../services/alertService');
const receptionService = require('../services/receptionService');
const reportService = require('../services/reportService');
const { RECEPTION_STATUS } = require('../utils/constants');

const step = (title, fn) => {
  console.log('\n' + '-'.repeat(70));
  console.log(`【${title}】`);
  console.log('-'.repeat(70));
  fn();
};

const logObject = (obj, indent = 0) => {
  const prefix = '  '.repeat(indent);
  Object.entries(obj).forEach(([k, v]) => {
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      console.log(`${prefix}${k}:`);
      logObject(v, indent + 1);
    } else if (Array.isArray(v)) {
      console.log(`${prefix}${k}: [${v.length}项]`);
    } else {
      console.log(`${prefix}${k}: ${v}`);
    }
  });
};

require('./seed');

const parts = SparePart.findAll().reduce((acc, p) => { acc[p.code] = p; return acc; }, {});
const equipments = Equipment.findAll().reduce((acc, e) => { acc[e.code] = e; return acc; }, {});

step('场景1: 正常领用流程 - 库存充足', () => {
  const part = parts['BEAR-001'];
  const equipment = equipments['EQ-001'];
  console.log(`领用: ${part.name} (当前库存: ${part.current_stock})`);
  console.log(`用于: ${equipment.name} (${equipment.criticality})`);
  
  const createResult = receptionService.createReception({
    partId: part.id,
    equipmentId: equipment.id,
    requestedQuantity: 2,
    requester: '维修班-张工',
    operator: '张工'
  });
  
  console.log(`\n状态变化:`);
  createResult.history.forEach(h => {
    console.log(`  [${h.from_status || '无'}] → [${h.to_status}] | ${h.reason}`);
  });
  
  console.log(`\n当前状态: ${createResult.reception.status}`);
  console.log(`领用单ID: ${createResult.reception.id}`);
  const receptionId = createResult.reception.id;
  
  const approveResult = receptionService.approveReception(receptionId, '李班长');
  console.log(`\n审批后状态: ${approveResult.reception.status}`);
  
  const processResult = receptionService.processReception(receptionId, '仓库管理员');
  console.log(`出库检查: ${processResult.message}`);
  console.log(`可出库: ${processResult.canProcess}`);
  
  const completeResult = receptionService.completeReception(receptionId, '仓库管理员');
  console.log(`\n出库完成:`);
  console.log(`  领用单状态: ${completeResult.reception.status}`);
  console.log(`  实际出库: ${completeResult.consumed} ${part.unit}`);
  
  const updatedPart = SparePart.findById(part.id);
  console.log(`  最新库存: ${updatedPart.current_stock}`);
  
  const history = receptionService.getReceptionDetail(receptionId);
  console.log(`\n状态历史完整追踪:`);
  history.history.forEach((h, i) => {
    console.log(`  ${i + 1}. [${h.created_at}] 操作人: ${h.operator || '系统'}`);
    console.log(`     ${h.from_status || '-'} → ${h.to_status}`);
    console.log(`     ${h.reason}`);
  });
});

step('场景2: 库存预警检测', () => {
  const alerts = alertService.checkAllParts();
  console.log(`检测结果: 发现 ${alerts.length} 个库存预警\n`);
  
  alerts.forEach((alert, i) => {
    console.log(`${i + 1}. [${alert.alertLevel}] ${alert.part.code} - ${alert.part.name}`);
    console.log(`   当前库存: ${alert.currentStock}, 最低库存: ${alert.minStock}`);
    console.log(`   在途数量: ${alert.inTransit}, 缺口: ${alert.minStock - alert.currentStock}`);
    console.log(`   影响设备: ${alert.affectedEquipments.map(e => `${e.code}(${e.criticality})`).join(', ')}`);
    if (alert.alertLevel === 'CRITICAL') {
      console.log(`   ⚠️ 关键设备受影响: ${alert.affectedEquipments.some(e => e.criticality === 'CRITICAL') ? '是' : '否'}`);
    }
  });
});

step('场景3: 替代件建议 - 库存不足但有替代', () => {
  const originalPart = parts['BEAR-001'];
  const equipment = equipments['EQ-004'];
  const currentStock = SparePart.findById(originalPart.id).current_stock;
  
  console.log(`领用: ${originalPart.code} ${originalPart.name}`);
  console.log(`当前库存: ${currentStock}, 需要: 5`);
  console.log(`用于: ${equipment.code} ${equipment.name}`);
  
  const alternatives = AlternativePart.findAlternatives(originalPart.id);
  console.log(`\n查询替代件: 找到 ${alternatives.length} 个`);
  alternatives.forEach(alt => {
    console.log(`  - ${alt.alt_code} ${alt.alt_name}`);
    console.log(`    库存: ${alt.alt_stock}, 兼容: ${alt.compatibility_status}`);
  });
  
  const createResult = receptionService.createReception({
    partId: originalPart.id,
    equipmentId: equipment.id,
    requestedQuantity: 5,
    requester: '维修班-王工'
  });
  const receptionId = createResult.reception.id;
  
  receptionService.approveReception(receptionId, '李班长');
  const processResult = receptionService.processReception(receptionId, '仓库管理员');
  
  console.log(`\n处理结果: ${processResult.message}`);
  console.log(`可用替代件: ${processResult.hasAlternative ? '是' : '否'}`);
  
  if (processResult.hasAlternative) {
    console.log(`\n建议替代件:`);
    processResult.alternatives.forEach((alt, i) => {
      console.log(`  ${i + 1}. ${alt.code} ${alt.name}`);
      console.log(`     库存: ${alt.stock}, 兼容性: ${alt.compatibility}`);
    });
    
    const selectedAlt = processResult.alternatives[0];
    console.log(`\n选择替代件: ${selectedAlt.code} ${selectedAlt.name}`);
    
    const useAltResult = receptionService.useAlternative(receptionId, selectedAlt.id, '仓库管理员');
    console.log(`使用替代件后状态: ${useAltResult.reception.status}`);
    
    const completeResult = receptionService.completeReception(receptionId, '仓库管理员');
    console.log(`\n出库完成:`);
    console.log(`  领用单状态: ${completeResult.reception.status}`);
    console.log(`  使用替代件: ${selectedAlt.code}`);
    console.log(`  原备件库存不变，替代件库存减少`);
    
    const altPart = SparePart.findById(selectedAlt.id);
    console.log(`  替代件最新库存: ${altPart.current_stock}`);
  }
});

step('场景4: 采购在途查询', () => {
  const part = parts['MOTOR-001'];
  const inTransit = PurchaseOrder.getInTransitQuantity(part.id);
  const orders = PurchaseOrder.getInTransitOrders(part.id);
  
  console.log(`备件: ${part.code} ${part.name}`);
  console.log(`当前库存: ${part.current_stock}`);
  console.log(`在途数量: ${inTransit}`);
  console.log(`\n采购单明细:`);
  orders.forEach((order, i) => {
    const days = Math.ceil((order.expected_arrival_date - Date.now()) / (24 * 60 * 60 * 1000));
    console.log(`  ${i + 1}. 数量: ${order.in_transit_quantity}, 预计到货: ${days}天后`);
  });
});

step('场景5: 重复领用回调 - 幂等测试', () => {
  const part = parts['SEAL-001'];
  const idempotentKey = 'CALLBACK_SEAL_20240115_001';
  
  console.log(`测试幂等: ${idempotentKey}`);
  console.log(`\n第一次回调:`);
  const createResult = receptionService.createReception({
    partId: part.id,
    requestedQuantity: 1,
    requester: '测试回调',
    idempotentKey,
    operator: '系统'
  });
  console.log(`  是否重复: ${createResult.isDuplicate}`);
  console.log(`  领用单ID: ${createResult.reception.id}`);
  
  console.log(`\n第二次回调 (相同KEY):`);
  const duplicateResult = receptionService.createReception({
    partId: part.id,
    requestedQuantity: 1,
    requester: '测试回调',
    idempotentKey,
    operator: '系统'
  });
  console.log(`  是否重复: ${duplicateResult.isDuplicate}`);
  console.log(`  领用单ID: ${duplicateResult.reception.id}`);
  console.log(`  说明: ${duplicateResult.message}`);
  
  const receptionId = createResult.reception.id;
  console.log(`\n测试回调重复记录:`);
  receptionService.callbackReception(receptionId, 'WEBHOOK_001', '外部系统');
  receptionService.callbackReception(receptionId, 'WEBHOOK_001', '外部系统');
  
  const detail = receptionService.getReceptionDetail(receptionId);
  console.log(`  回调次数: ${detail.reception.callback_count}`);
  console.log(`  最后回调: ${detail.reception.last_callback_at ? '已记录' : '无'}`);
});

step('场景6: 风险报告 - 备件风险评估', () => {
  const report = reportService.generateRiskReport();
  console.log('风险汇总:');
  logObject(report.summary, 1);
  
  console.log('\n风险明细 (TOP 3):');
  report.risks.slice(0, 3).forEach((r, i) => {
    console.log(`\n  ${i + 1}. [${r.alertLevel}] ${r.part.code} - ${r.part.name}`);
    console.log(`     当前: ${r.currentStock}, 最低: ${r.minStock}, 缺口: ${r.deficit}`);
    console.log(`     在途: ${r.inTransit}, 紧急: ${r.urgent ? '是' : '否'}`);
  });
});

step('场景7: 设备影响报告', () => {
  const report = reportService.generateEquipmentImpactReport();
  console.log('设备影响汇总:');
  logObject(report.summary, 1);
  
  console.log('\n受影响设备 (TOP 3):');
  report.equipments.filter(e => e.impactLevel !== 'NONE').slice(0, 3).forEach((e, i) => {
    console.log(`\n  ${i + 1}. [${e.impactLevel}] ${e.equipment.code} - ${e.equipment.name}`);
    console.log(`     关键性: ${e.equipment.criticality}`);
    console.log(`     受影响备件: ${e.affectedPartCount}/${e.totalParts}`);
    if (e.affectedParts.length > 0) {
      e.affectedParts.forEach(p => {
        console.log(`       - [${p.alertLevel}] ${p.code}: ${p.currentStock}/${p.minStock}`);
      });
    }
  });
});

step('场景8: 采购建议报告', () => {
  const report = reportService.generatePurchaseSuggestionReport();
  console.log('采购建议汇总:');
  logObject(report.summary, 1);
  
  console.log('\n采购建议 (TOP 3):');
  report.suggestions.slice(0, 3).forEach((s, i) => {
    console.log(`\n  ${i + 1}. [${s.urgency}] ${s.part.code} - ${s.part.name}`);
    console.log(`     当前: ${s.currentStock}, 在途: ${s.inTransit}, 最低: ${s.minStock}`);
    console.log(`     缺口: ${s.deficit}, 建议采购: ${s.suggestedQuantity}`);
    console.log(`     采购周期: ${s.cycleDays}天`);
    console.log(`     关键设备: ${s.hasCriticalEquipment ? '是' : '否'}`);
  });
});

step('场景9: 人工修正记录', () => {
  const part = parts['FILT-001'];
  const before = { currentStock: 2, minStock: 3 };
  const after = { currentStock: 5, minStock: 5 };
  
  console.log(`修正对象: ${part.code} ${part.name}`);
  console.log(`修正前:`, before);
  console.log(`修正后:`, after);
  
  const result = receptionService.manualCorrect(
    'SPARE_PART',
    part.id,
    before,
    after,
    '仓库主管-赵经理',
    '盘点发现实际库存与系统不符，重新校准'
  );
  
  console.log(`\n修正结果:`);
  console.log(`  记录ID: ${result.id}`);
  console.log(`  差异字段:`);
  Object.entries(result.diff).forEach(([k, v]) => {
    console.log(`    - ${k}: ${v.before} → ${v.after}`);
  });
});

console.log('\n' + '='.repeat(70));
console.log('演示完成！所有场景执行完毕');
console.log('='.repeat(70));
console.log('\n查看详细报告:');
console.log('  GET http://localhost:3000/api/reports/full');
console.log('  GET http://localhost:3000/api/reports/export');
console.log('');
