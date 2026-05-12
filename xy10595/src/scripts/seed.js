const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../../data/spare-parts.db');
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log('已清除旧数据库');
}

const initSchema = require('../config/schema');
initSchema();

const SparePart = require('../models/sparePart');
const Equipment = require('../models/equipment');
const Consumption = require('../models/consumption');
const PurchaseCycle = require('../models/purchaseCycle');
const AlternativePart = require('../models/alternativePart');
const PurchaseOrder = require('../models/purchaseOrder');
const MinStock = require('../models/minStock');
const { EQUIPMENT_CRITICALITY, REPLACEMENT_STATUS } = require('../utils/constants');
const stockCalculator = require('../services/stockCalculator');

const data = { parts: {}, equipments: {} };

console.log('\n=== 初始化样例数据 ===\n');

console.log('1. 创建备件档案...');
data.parts.bearing = SparePart.create({
  code: 'BEAR-001',
  name: '高速精密轴承 6205',
  category: '传动件',
  unit: '套',
  currentStock: 5
});
console.log('   - BEAR-001 高速精密轴承 6205, 库存: 5');

data.parts.bearingAlt = SparePart.create({
  code: 'BEAR-002',
  name: '普通轴承 6205',
  category: '传动件',
  unit: '套',
  currentStock: 10
});
console.log('   - BEAR-002 普通轴承 6205, 库存: 10');

data.parts.hydraulicPump = SparePart.create({
  code: 'HYD-001',
  name: '主液压泵 A10VSO',
  category: '液压件',
  unit: '台',
  currentStock: 1
});
console.log('   - HYD-001 主液压泵 A10VSO, 库存: 1');

data.parts.filter = SparePart.create({
  code: 'FILT-001',
  name: '高压滤芯 HF35150',
  category: '过滤件',
  unit: '个',
  currentStock: 2
});
console.log('   - FILT-001 高压滤芯 HF35150, 库存: 2');

data.parts.motor = SparePart.create({
  code: 'MOTOR-001',
  name: '主电机 Y2-225M-4 45KW',
  category: '电气件',
  unit: '台',
  currentStock: 0
});
console.log('   - MOTOR-001 主电机 Y2-225M-4 45KW, 库存: 0 (已缺货)');

data.parts.seal = SparePart.create({
  code: 'SEAL-001',
  name: '骨架油封 TC60*80*10',
  category: '密封件',
  unit: '个',
  currentStock: 3
});
console.log('   - SEAL-001 骨架油封, 库存: 3');

console.log('\n2. 创建设备档案...');
data.equipments.press = Equipment.create({
  code: 'EQ-001',
  name: '1号冲压生产线',
  criticality: EQUIPMENT_CRITICALITY.CRITICAL,
  department: '冲压车间'
});
console.log('   - EQ-001 1号冲压生产线 (关键设备)');

data.equipments.lathe = Equipment.create({
  code: 'EQ-002',
  name: '2号数控车床',
  criticality: EQUIPMENT_CRITICALITY.IMPORTANT,
  department: '机加工车间'
});
console.log('   - EQ-002 2号数控车床 (重要设备)');

data.equipments.hydraulic = Equipment.create({
  code: 'EQ-003',
  name: '3号液压站',
  criticality: EQUIPMENT_CRITICALITY.CRITICAL,
  department: '装配车间'
});
console.log('   - EQ-003 3号液压站 (关键设备)');

data.equipments.conveyor = Equipment.create({
  code: 'EQ-004',
  name: '4号输送线',
  criticality: EQUIPMENT_CRITICALITY.NORMAL,
  department: '物流车间'
});
console.log('   - EQ-004 4号输送线 (普通设备)');

console.log('\n3. 建立设备-备件关联...');
Equipment.linkPart(data.equipments.press, data.parts.bearing);
Equipment.linkPart(data.equipments.press, data.parts.motor);
Equipment.linkPart(data.equipments.lathe, data.parts.bearing);
Equipment.linkPart(data.equipments.lathe, data.parts.filter);
Equipment.linkPart(data.equipments.hydraulic, data.parts.hydraulicPump);
Equipment.linkPart(data.equipments.hydraulic, data.parts.filter);
Equipment.linkPart(data.equipments.hydraulic, data.parts.seal);
Equipment.linkPart(data.equipments.conveyor, data.parts.bearing);
Equipment.linkPart(data.equipments.conveyor, data.parts.seal);
console.log('   关联完成');

console.log('\n4. 创建采购周期...');
PurchaseCycle.create({
  partId: data.parts.bearing,
  supplier: 'SKF授权经销商',
  cycleDays: 7,
  isPrimary: true
});
PurchaseCycle.create({
  partId: data.parts.bearingAlt,
  supplier: '本地轴承供应商',
  cycleDays: 2,
  isPrimary: true
});
PurchaseCycle.create({
  partId: data.parts.hydraulicPump,
  supplier: '博世力士乐',
  cycleDays: 45,
  isPrimary: true
});
PurchaseCycle.create({
  partId: data.parts.filter,
  supplier: '黎明液压',
  cycleDays: 14,
  isPrimary: true
});
PurchaseCycle.create({
  partId: data.parts.motor,
  supplier: '西门子电机',
  cycleDays: 60,
  isPrimary: true
});
PurchaseCycle.create({
  partId: data.parts.seal,
  supplier: 'NOK授权经销商',
  cycleDays: 10,
  isPrimary: true
});
console.log('   采购周期设置完成');

console.log('\n5. 建立替代件关系...');
AlternativePart.create({
  originalPartId: data.parts.bearing,
  alternativePartId: data.parts.bearingAlt,
  compatibilityStatus: REPLACEMENT_STATUS.LIMITED,
  limitEquipmentIds: [data.equipments.conveyor, data.equipments.lathe]
});
console.log('   - BEAR-001 可用 BEAR-002 替代 (仅限 EQ-004, EQ-002)');

console.log('\n6. 创建历史消耗记录...');
const now = Date.now();
const days30 = 30 * 24 * 60 * 60 * 1000;
const days60 = 60 * 24 * 60 * 60 * 1000;
const days90 = 90 * 24 * 60 * 60 * 1000;

[
  { partId: data.parts.bearing, equipmentId: data.equipments.press, qty: 2, offset: days90 },
  { partId: data.parts.bearing, equipmentId: data.equipments.lathe, qty: 1, offset: days60 },
  { partId: data.parts.bearing, equipmentId: data.equipments.conveyor, qty: 1, offset: days30 },
  { partId: data.parts.filter, equipmentId: data.equipments.lathe, qty: 1, offset: days60 },
  { partId: data.parts.filter, equipmentId: data.equipments.hydraulic, qty: 2, offset: days30 },
  { partId: data.parts.seal, equipmentId: data.equipments.hydraulic, qty: 3, offset: days60 },
  { partId: data.parts.seal, equipmentId: data.equipments.conveyor, qty: 2, offset: days30 },
  { partId: data.parts.hydraulicPump, equipmentId: data.equipments.hydraulic, qty: 1, offset: days90 },
  { partId: data.parts.motor, equipmentId: data.equipments.press, qty: 1, offset: days90 },
].forEach(c => {
  Consumption.create({
    partId: c.partId,
    equipmentId: c.equipmentId,
    quantity: c.qty,
    consumptionDate: now - c.offset
  });
});
console.log('   消耗记录创建完成');

console.log('\n7. 创建在途采购单...');
PurchaseOrder.create({
  partId: data.parts.motor,
  quantity: 2,
  inTransitQuantity: 2,
  expectedArrivalDate: now + 30 * 24 * 60 * 60 * 1000
});
console.log('   - MOTOR-001 采购在途: 2台 (30天后到货)');

PurchaseOrder.create({
  partId: data.parts.bearing,
  quantity: 5,
  inTransitQuantity: 5,
  expectedArrivalDate: now + 3 * 24 * 60 * 60 * 1000
});
console.log('   - BEAR-001 采购在途: 5套 (3天后到货)');

console.log('\n8. 计算最低库存...');
Object.values(data.parts).forEach(partId => {
  const result = stockCalculator.updateMinStockRule(partId);
  const part = SparePart.findById(partId);
  console.log(`   - ${part.code}: 最低库存 = ${result.minQuantity} (日消耗: ${result.avgDailyConsumption.toFixed(2)}, 采购周期: ${result.cycleDays}天)`);
});

console.log('\n=== 样例数据初始化完成 ===\n');

module.exports = data;
