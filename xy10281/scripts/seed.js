const { v4: uuidv4 } = require('uuid');
const { initDatabase } = require('../src/database/schema');
const FishGroupDao = require('../src/daos/fishGroupDao');
const TankDao = require('../src/daos/tankDao');
const IsolationRuleDao = require('../src/daos/isolationRuleDao');

const sampleTanks = [
  {
    id: uuidv4(),
    name: '主缸 A',
    type: 'main',
    capacity: 100,
    waterPh: 7.2,
    waterTemperature: 26,
    waterSalinity: 0.0,
    isQuarantineReady: false
  },
  {
    id: uuidv4(),
    name: '主缸 B',
    type: 'main',
    capacity: 80,
    waterPh: 7.0,
    waterTemperature: 25,
    waterSalinity: 0.0,
    isQuarantineReady: false
  },
  {
    id: uuidv4(),
    name: '隔离缸 1',
    type: 'quarantine',
    capacity: 30,
    waterPh: 7.5,
    waterTemperature: 26,
    waterSalinity: 0.0,
    isQuarantineReady: true
  },
  {
    id: uuidv4(),
    name: '隔离缸 2',
    type: 'quarantine',
    capacity: 30,
    waterPh: 7.3,
    waterTemperature: 25,
    waterSalinity: 0.0,
    isQuarantineReady: true
  },
  {
    id: uuidv4(),
    name: '治疗缸 1',
    type: 'hospital',
    capacity: 20,
    waterPh: 7.4,
    waterTemperature: 28,
    waterSalinity: 0.0,
    isQuarantineReady: true
  }
];

const sampleFishGroups = [
  {
    id: uuidv4(),
    species: 'carassius_auratus',
    speciesName: '金鱼',
    count: 20,
    tankId: null
  },
  {
    id: uuidv4(),
    species: 'paracheirodon_innesi',
    speciesName: '红绿灯鱼',
    count: 50,
    tankId: null
  },
  {
    id: uuidv4(),
    species: 'pterophyllum_scalare',
    speciesName: '神仙鱼',
    count: 10,
    tankId: null
  }
];

const sampleRules = [
  {
    id: uuidv4(),
    diseaseName: '白点病',
    affectedSpecies: null,
    requiredTankType: 'quarantine',
    minPh: 6.8,
    maxPh: 8.0,
    minTemperature: 28.0,
    maxTemperature: 32.0,
    maxSalinity: 0.5,
    minQualityScore: 80,
    quarantineDays: 14,
    priority: 2,
    isActive: true
  },
  {
    id: uuidv4(),
    diseaseName: '水霉病',
    affectedSpecies: null,
    requiredTankType: 'hospital',
    minPh: 6.5,
    maxPh: 7.5,
    minTemperature: 25.0,
    maxTemperature: 28.0,
    maxSalinity: 0.3,
    minQualityScore: 85,
    quarantineDays: 21,
    priority: 3,
    isActive: true
  },
  {
    id: uuidv4(),
    diseaseName: '烂鳃病',
    affectedSpecies: 'carassius_auratus',
    requiredTankType: 'hospital',
    minPh: 7.0,
    maxPh: 7.8,
    minTemperature: 24.0,
    maxTemperature: 26.0,
    maxSalinity: 0.2,
    minQualityScore: 90,
    quarantineDays: 10,
    priority: 1,
    isActive: true
  }
];

async function seed() {
  console.log('开始初始化样例数据...');
  await initDatabase();
  
  for (const tank of sampleTanks) {
    await TankDao.create(tank);
    console.log(`创建缸体: ${tank.name}`);
  }
  
  sampleFishGroups[0].tankId = sampleTanks[0].id;
  sampleFishGroups[1].tankId = sampleTanks[0].id;
  sampleFishGroups[2].tankId = sampleTanks[1].id;
  
  for (const fg of sampleFishGroups) {
    await FishGroupDao.create(fg.id, fg.species, fg.speciesName, fg.count, fg.tankId);
    console.log(`创建鱼群: ${fg.speciesName} (${fg.count} 条)`);
  }
  
  await TankDao.updateOccupancy(sampleTanks[0].id, sampleFishGroups[0].count + sampleFishGroups[1].count);
  await TankDao.updateOccupancy(sampleTanks[1].id, sampleFishGroups[2].count);
  console.log('更新缸体占用情况');
  
  for (const rule of sampleRules) {
    await IsolationRuleDao.create(rule);
    console.log(`创建隔离规则: ${rule.diseaseName}`);
  }
  
  console.log('\n样例数据初始化完成！');
  console.log('\n数据汇总:');
  console.log(`- 缸体数量: ${sampleTanks.length} 个`);
  console.log(`- 鱼群数量: ${sampleFishGroups.length} 群`);
  console.log(`- 隔离规则: ${sampleRules.length} 条`);
  console.log('\n可用命令:');
  console.log('  npm start    - 启动 API 服务');
  console.log('  npm test     - 运行测试');
  console.log('  npm demo     - 运行演示脚本');
}

seed().catch(console.error);
