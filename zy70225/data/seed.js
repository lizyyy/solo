const { savePond, pondTypes, generateId } = require('../src/store');

const SAMPLE_PONDS = [
  {
    id: 'pond-hatchery-001',
    name: '孵化池-A1',
    type: pondTypes.HATCHERY,
    volume: 5,
    waterTemp: 23,
    currentBatchId: null,
    currentCount: 0,
    location: '孵化区-1号'
  },
  {
    id: 'pond-hatchery-002',
    name: '孵化池-A2',
    type: pondTypes.HATCHERY,
    volume: 5,
    waterTemp: 25,
    currentBatchId: null,
    currentCount: 0,
    location: '孵化区-2号'
  },
  {
    id: 'pond-nursery-001',
    name: '育苗池-B1',
    type: pondTypes.NURSERY,
    volume: 20,
    waterTemp: 22,
    currentBatchId: null,
    currentCount: 0,
    location: '育苗区-1号'
  },
  {
    id: 'pond-nursery-002',
    name: '育苗池-B2',
    type: pondTypes.NURSERY,
    volume: 20,
    waterTemp: 24,
    currentBatchId: null,
    currentCount: 0,
    location: '育苗区-2号'
  },
  {
    id: 'pond-growout-001',
    name: '养成池-C1',
    type: pondTypes.GROWOUT,
    volume: 100,
    waterTemp: 20,
    currentBatchId: null,
    currentCount: 0,
    location: '养成区-1号'
  }
];

function seedData() {
  console.log('\n=== 加载样例池塘数据 ===');
  SAMPLE_PONDS.forEach(pondTemplate => {
    const pond = {
      ...pondTemplate,
      currentBatchId: null,
      currentCount: 0
    };
    savePond(pond);
    console.log(`  [${pond.type}] ${pond.name} (${pond.volume}m³, ${pond.waterTemp}°C)`);
  });
  console.log(`共加载 ${SAMPLE_PONDS.length} 个池塘\n`);
}

function getSamplePonds() {
  return SAMPLE_PONDS;
}

module.exports = {
  seedData,
  getSamplePonds,
  SAMPLE_PONDS
};