const fs = require('fs');
const path = require('path');

const TankModel = require('../src/models/tank');
const BatchModel = require('../src/models/batch');
const WaterQualityModel = require('../src/models/waterQuality');
const AlertModel = require('../src/models/alert');
const DeathLossModel = require('../src/models/deathLoss');
const OperationLogModel = require('../src/models/operationLog');
const ThresholdService = require('../src/services/thresholdService');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

TankModel.init();
BatchModel.init();
WaterQualityModel.init();
AlertModel.init();
DeathLossModel.init();
OperationLogModel.init();

const now = new Date();
const hours24 = 24 * 60 * 60 * 1000;
const hours2 = 2 * 60 * 60 * 1000;

function generateTime(offset = 0) {
  return new Date(now.getTime() - offset).toISOString();
}

console.log('开始初始化样例数据...');

const tanks = [
  { name: '1号虾池', capacity: 5000, species_type: '虾类', temperature_min: 18, temperature_max: 26, salinity_min: 28, salinity_max: 34, oxygen_min: 6, oxygen_max: 10 },
  { name: '2号虾池', capacity: 5000, species_type: '虾类', temperature_min: 18, temperature_max: 26, salinity_min: 28, salinity_max: 34, oxygen_min: 6, oxygen_max: 10 },
  { name: '3号鱼池', capacity: 8000, species_type: '鱼类', temperature_min: 14, temperature_max: 22, salinity_min: 20, salinity_max: 28, oxygen_min: 5, oxygen_max: 9 },
  { name: '4号蟹池', capacity: 3000, species_type: '蟹类', temperature_min: 16, temperature_max: 24, salinity_min: 25, salinity_max: 32, oxygen_min: 5, oxygen_max: 8 }
];

const createdTanks = tanks.map(t => TankModel.create(t));
console.log(`  创建了 ${createdTanks.length} 个暂养池`);

const batches = [
  { batch_number: 'X20240510001', species: '基围虾', quantity: 500, entry_date: generateTime(hours24 * 2), source: '福建厦门', supplier: 'XX水产' },
  { batch_number: 'X20240510002', species: '斑节虾', quantity: 300, entry_date: generateTime(hours24 * 1), source: '广东湛江', supplier: 'YY渔业' },
  { batch_number: 'Y20240510001', species: '鲈鱼', quantity: 200, entry_date: generateTime(hours24 * 3), source: '山东威海', supplier: 'ZZ海产' },
  { batch_number: 'Y20240510002', species: '多宝鱼', quantity: 150, entry_date: generateTime(hours24 * 1), source: '山东烟台', supplier: 'WW水产' },
  { batch_number: 'X20240509003', species: '大闸蟹', quantity: 100, entry_date: generateTime(hours24 * 4), source: '江苏苏州', supplier: 'VV蟹业' }
];

const createdBatches = batches.map(b => BatchModel.create(b));
console.log(`  创建了 ${createdBatches.length} 个批次`);

console.log('  绑定批次到暂养池...');
BatchModel.bindToTank(createdBatches[0].id, createdTanks[0].id);
BatchModel.bindToTank(createdBatches[1].id, createdTanks[1].id);
BatchModel.bindToTank(createdBatches[2].id, createdTanks[2].id);
BatchModel.bindToTank(createdBatches[4].id, createdTanks[3].id);

console.log('  生成水质历史数据...');

const waterRecords = [];

for (let i = 0; i < 12; i++) {
  const offset = (12 - i) * hours2;
  const time = generateTime(offset);
  
  const tank0Temp = 22 + (Math.random() - 0.5) * 2;
  const tank0Sal = 31 + (Math.random() - 0.5) * 1;
  const tank0Ox = 8 + (Math.random() - 0.5) * 1;
  
  waterRecords.push(ThresholdService.importWaterQuality({
    tank_id: createdTanks[0].id,
    temperature: tank0Temp,
    salinity: tank0Sal,
    oxygen: tank0Ox,
    recorded_at: time
  }, 'seeder'));
  
  const tank2Temp = 18 + (Math.random() - 0.5) * 1.5;
  const tank2Sal = 24 + (Math.random() - 0.5) * 1;
  const tank2Ox = 7 + (Math.random() - 0.5) * 0.8;
  
  waterRecords.push(ThresholdService.importWaterQuality({
    tank_id: createdTanks[2].id,
    temperature: tank2Temp,
    salinity: tank2Sal,
    oxygen: tank2Ox,
    recorded_at: time
  }, 'seeder'));
}

console.log(`  导入了 ${waterRecords.length} 条正常水质记录`);

console.log('  生成异常水质数据（触发报警）...');

const abnormalResult1 = ThresholdService.importWaterQuality({
  tank_id: createdTanks[0].id,
  temperature: 28,
  salinity: 31,
  oxygen: 8,
  recorded_at: generateTime(hours2)
}, 'seeder');

const abnormalResult2 = ThresholdService.importWaterQuality({
  tank_id: createdTanks[2].id,
  temperature: 18,
  salinity: 24,
  oxygen: 4.5,
  recorded_at: generateTime(hours2 * 0.5)
}, 'seeder');

console.log(`  异常数据1触发了 ${abnormalResult1.checkResult.alertsGenerated} 条报警`);
console.log(`  异常数据2触发了 ${abnormalResult2.checkResult.alertsGenerated} 条报警`);

console.log('  生成死耗记录...');

const death1 = DeathLossModel.create({
  batch_id: createdBatches[0].id,
  tank_id: createdTanks[0].id,
  quantity: 25,
  discovered_at: generateTime(hours2 * 0.3),
  reported_by: '张三',
  initial_cause: 'temperature'
});

BatchModel.addDeath(createdBatches[0].id, 25);

const death2 = DeathLossModel.create({
  batch_id: createdBatches[2].id,
  tank_id: createdTanks[2].id,
  quantity: 15,
  discovered_at: generateTime(hours2 * 0.2),
  reported_by: '李四',
  initial_cause: 'oxygen'
});

BatchModel.addDeath(createdBatches[2].id, 15);

console.log(`  创建了 2 条死耗记录`);

OperationLogModel.create({
  operation_type: 'system',
  target_type: 'system',
  operator: 'system',
  details: '样例数据初始化完成'
});

const activeAlerts = AlertModel.getActive();
const pendingLosses = DeathLossModel.getAll().filter(d => d.attribution_status === 'pending');
const tanksSummary = TankModel.getAll();
const activeBatches = BatchModel.getAll().filter(b => b.status === 'active');

console.log('\n===== 数据初始化完成 =====');
console.log(`\n  暂养池: ${tanksSummary.length} 个`);
tanksSummary.forEach(t => {
  console.log(`    - ${t.name}: ${t.status}`);
});
console.log(`\n  批次: ${BatchModel.getAll().length} 个`);
console.log(`    - 活跃: ${activeBatches.length}`);
console.log(`\n  水质记录: ${WaterQualityModel.getAll().length} 条`);
console.log(`\n  报警: ${AlertModel.getAll().length} 条`);
console.log(`    - 活跃: ${activeAlerts.length}`);
console.log(`\n  死耗记录: ${DeathLossModel.getAll().length} 条`);
console.log(`    - 待归因: ${pendingLosses.length}`);
console.log(`\n  操作日志: ${OperationLogModel.getAll().length} 条`);

console.log('\n===== 样例场景说明 =====');
console.log('');
console.log('场景1: 1号虾池温度异常');
console.log('  - 批次 X20240510001 (基围虾) 绑定在1号虾池');
console.log('  - 最近一次水质检测温度 28°C (阈值 18-26°C)');
console.log('  - 已触发温度过高报警');
console.log('  - 死耗 25 斤，待归因');
console.log('');
console.log('场景2: 3号鱼池溶氧不足');
console.log('  - 批次 Y20240510001 (鲈鱼) 绑定在3号鱼池');
console.log('  - 最近一次水质检测溶氧 4.5mg/L (阈值 5-9mg/L)');
console.log('  - 已触发溶氧过低报警');
console.log('  - 死耗 15 尾，待归因');
console.log('');
console.log('场景3: 未绑定批次');
console.log('  - 批次 Y20240510002 (多宝鱼) 状态: pending');
console.log('  - 需要绑定到暂养池');
console.log('');
console.log('场景4: 空暂养池');
console.log('  - 2号虾池状态: normal');
console.log('  - 可用于绑定新批次');
console.log('');
