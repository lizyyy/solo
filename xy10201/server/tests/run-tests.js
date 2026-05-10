const fs = require('fs');
const path = require('path');

const TEST_DB_PATH = path.join(__dirname, '../../data/test.db');

if (fs.existsSync(TEST_DB_PATH)) {
  fs.unlinkSync(TEST_DB_PATH);
}

process.env.DB_PATH = TEST_DB_PATH;

require('../scripts/init-db');
require('../scripts/seed-data');

const { getDatabase, closeDatabase } = require('../config/database');
const materialService = require('../services/materialService');
const treatmentService = require('../services/treatmentService');
const consumptionService = require('../services/consumptionService');
const replenishmentService = require('../services/replenishmentService');
const dashboardService = require('../services/dashboardService');

console.log('\n========================================');
console.log('  牙科椅旁耗材补货台 - 测试套件');
console.log('========================================\n');

let passed = 0;
let failed = 0;
let tests = [];

function test(description, fn) {
  try {
    const result = fn();
    if (result !== undefined && result === false) {
      throw new Error('断言失败');
    }
    console.log(`  ✓ ${description}`);
    passed++;
    tests.push({ description, status: 'passed' });
    return true;
  } catch (error) {
    console.log(`  ✗ ${description}`);
    console.log(`    错误: ${error.message}`);
    failed++;
    tests.push({ description, status: 'failed', error: error.message });
    return false;
  }
}

console.log('【1】基础数据测试');
console.log('----------------------------------------');

test('科室数据应存在', () => {
  const depts = consumptionService.getDepartments();
  return depts.length > 0;
});

test('耗材数据应存在且包含库存状态', () => {
  const materials = materialService.getAllMaterials();
  return materials.length > 0 && materials[0].stock_status !== undefined;
});

test('诊疗项目应绑定耗材', () => {
  const treatment = treatmentService.getTreatmentById(1);
  return treatment && treatment.materials && treatment.materials.length > 0;
});

console.log('\n【2】库存预警测试');
console.log('----------------------------------------');

test('样例数据中应有低库存耗材', () => {
  const lowStock = materialService.getLowStockMaterials();
  return lowStock.length > 0;
});

test('低库存检测应正确识别状态', () => {
  const lowStock = materialService.getLowStockMaterials();
  return lowStock.every(m => m.stock_status === 'LOW_STOCK' || m.stock_status === 'OUT_OF_STOCK');
});

test('可获取耗材历史记录', () => {
  const history = materialService.getMaterialHistory(1);
  return Array.isArray(history);
});

console.log('\n【3】诊疗项目库存检测测试');
console.log('----------------------------------------');

test('应能检测诊疗项目耗材库存情况', () => {
  const check = treatmentService.checkTreatmentStock(1);
  return check.can_perform !== undefined && check.shortage_count !== undefined;
});

test('补牙项目(绑定5种耗材)应有库存问题', () => {
  const check = treatmentService.checkTreatmentStock(1);
  return check.shortage_count > 0;
});

console.log('\n【4】耗材消耗测试');
console.log('----------------------------------------');

test('手动消耗应成功扣减库存', () => {
  const before = materialService.getMaterialById(2).current_stock;
  consumptionService.consumeByManual({
    departmentId: 1,
    materialId: 2,
    quantity: 3,
    operator: '护士小王',
    patientName: '测试患者'
  });
  const after = materialService.getMaterialById(2).current_stock;
  return after === before - 3;
});

test('库存不足时消耗应抛出错误', () => {
  let threw = false;
  try {
    consumptionService.consumeByManual({
      departmentId: 1,
      materialId: 4,
      quantity: 100,
      operator: '护士小王'
    });
  } catch (e) {
    threw = e.message.includes('库存不足');
  }
  return threw;
});

test('消耗后应生成历史快照', () => {
  const history = materialService.getMaterialHistory(2);
  const hasConsumption = history.some(h => h.snapshot_type === 'CONSUMPTION');
  return hasConsumption;
});

console.log('\n【5】补货申请状态流转测试');
console.log('----------------------------------------');

let requestId = null;

test('应能创建补货申请', () => {
  const request = replenishmentService.createRequest({
    departmentId: 1,
    materialId: 1,
    requestedQuantity: 30,
    reason: '库存不足，需补充',
    requester: '护士小王'
  });
  requestId = request.id;
  return request.status === 'PENDING' && request.request_no.startsWith('RP-');
});

test('待审核状态应可通过', () => {
  const approved = replenishmentService.approveRequest(requestId, {
    auditor: '护士长',
    approvedQuantity: 25,
    comments: '同意补货25支'
  });
  return approved.status === 'APPROVED';
});

test('已通过状态应可完成补货', () => {
  const before = materialService.getMaterialById(1).current_stock;
  const fulfilled = replenishmentService.fulfillRequest(requestId, {
    operator: '库管小李'
  });
  const after = materialService.getMaterialById(1).current_stock;
  return fulfilled.status === 'FULFILLED' && after === before + 25;
});

test('已拒绝状态不能再通过', () => {
  const newRequest = replenishmentService.createRequest({
    departmentId: 1,
    materialId: 2,
    requestedQuantity: 10,
    requester: '测试'
  });
  
  replenishmentService.rejectRequest(newRequest.id, {
    auditor: '护士长',
    comments: '库存充足，暂不需要'
  });
  
  let threw = false;
  try {
    replenishmentService.approveRequest(newRequest.id, { auditor: '测试' });
  } catch (e) {
    threw = e.message.includes('状态') && e.message.includes('不允许');
  }
  return threw;
});

test('补录后应可追溯完整历史', () => {
  const full = replenishmentService.getRequestWithFullHistory(requestId);
  return full.audit_history.length > 0 && 
         full.stock_history.some(s => s.snapshot_type === 'REPLENISHMENT');
});

console.log('\n【6】仪表盘业务状态测试');
console.log('----------------------------------------');

test('仪表盘应返回统计数据', () => {
  const stats = dashboardService.getDashboardStats();
  return stats.total_materials > 0 && stats.low_stock_count !== undefined;
});

test('应能检测当前卡点', () => {
  const blockages = dashboardService.getCurrentBlockages();
  return Array.isArray(blockages);
});

test('业务流程状态应反映实际情况', () => {
  const flow = dashboardService.getBusinessFlowStatus();
  return flow.overall_status !== undefined && 
         Array.isArray(flow.stages) && 
         flow.stages.length === 4;
});

test('应能获取处理建议', () => {
  const suggestions = dashboardService.getTreatmentSuggestions();
  return Array.isArray(suggestions);
});

test('应能获取最近操作历史', () => {
  const history = dashboardService.getRecentHistory(10);
  return history.length > 0;
});

console.log('\n【7】数据一致性测试');
console.log('----------------------------------------');

test('补货审核量应与实际入库一致', () => {
  const request = replenishmentService.getRequestById(requestId);
  const history = materialService.getMaterialHistory(1);
  const replenishmentRecord = history.find(h => 
    h.snapshot_type === 'REPLENISHMENT' && 
    h.reference_type === 'REPLENISHMENT_REQUEST' &&
    h.reference_id === requestId
  );
  
  return replenishmentRecord && 
         replenishmentRecord.change_quantity === request.approved_quantity;
});

test('操作日志应记录关键操作', () => {
  const db = getDatabase();
  const logs = db.prepare(`
    SELECT * FROM operation_logs 
    ORDER BY created_at DESC 
    LIMIT 10
  `).all();
  return logs.length > 0;
});

console.log('\n----------------------------------------');
console.log(`测试结果: ${passed} 通过, ${failed} 失败`);
console.log('========================================\n');

closeDatabase();

if (fs.existsSync(TEST_DB_PATH)) {
  fs.unlinkSync(TEST_DB_PATH);
}

process.exit(failed > 0 ? 1 : 0);
