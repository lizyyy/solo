import prisma from '../utils/prisma';
import { SlopeDifficulty, VehicleStatus } from '../utils/constants';

const sampleSlopes = [
  {
    name: '初级练习道1号',
    difficulty: SlopeDifficulty.EASY,
    length: 500,
    area: 15000,
    openWindowStart: '08:00',
    openWindowEnd: '18:00',
    minSnowThickness: 20,
    targetSnowThickness: 40,
    currentSnowThickness: 15,
    priority: 3
  },
  {
    name: '初级练习道2号',
    difficulty: SlopeDifficulty.EASY,
    length: 600,
    area: 18000,
    openWindowStart: '08:00',
    openWindowEnd: '18:00',
    minSnowThickness: 20,
    targetSnowThickness: 40,
    currentSnowThickness: 25,
    priority: 4
  },
  {
    name: '中级雪道1号',
    difficulty: SlopeDifficulty.MEDIUM,
    length: 1000,
    area: 30000,
    openWindowStart: '08:00',
    openWindowEnd: '17:00',
    minSnowThickness: 25,
    targetSnowThickness: 45,
    currentSnowThickness: 18,
    priority: 2
  },
  {
    name: '高级雪道1号',
    difficulty: SlopeDifficulty.HARD,
    length: 1500,
    area: 45000,
    openWindowStart: '09:00',
    openWindowEnd: '17:00',
    minSnowThickness: 30,
    targetSnowThickness: 50,
    currentSnowThickness: 22,
    priority: 1
  },
  {
    name: '专业竞技道',
    difficulty: SlopeDifficulty.EXPERT,
    length: 2000,
    area: 60000,
    openWindowStart: '09:00',
    openWindowEnd: '16:00',
    minSnowThickness: 35,
    targetSnowThickness: 55,
    currentSnowThickness: 50,
    priority: 5
  }
];

const sampleVehicles = [
  {
    name: '压雪车A1',
    model: 'PistenBully 400',
    status: VehicleStatus.AVAILABLE,
    capacityPerHour: 10000,
    currentLocation: '停车场A区'
  },
  {
    name: '压雪车A2',
    model: 'PistenBully 600',
    status: VehicleStatus.AVAILABLE,
    capacityPerHour: 15000,
    currentLocation: '停车场A区'
  },
  {
    name: '压雪车B1',
    model: 'Prinoth Leitwolf',
    status: VehicleStatus.AVAILABLE,
    capacityPerHour: 12000,
    currentLocation: '停车场B区'
  },
  {
    name: '压雪车B2',
    model: 'Prinoth Bison X',
    status: VehicleStatus.MAINTENANCE,
    capacityPerHour: 14000,
    currentLocation: '维修车间'
  },
  {
    name: '压雪车C1',
    model: 'PistenBully 100',
    status: VehicleStatus.BROKEN,
    capacityPerHour: 8000,
    currentLocation: '维修车间'
  }
];

async function main() {
  console.log('开始初始化示例数据...');
  
  await prisma.$transaction([
    prisma.report.deleteMany(),
    prisma.task.deleteMany(),
    prisma.vehicle.deleteMany(),
    prisma.slope.deleteMany()
  ]);
  
  console.log('已清空现有数据');
  
  for (const slope of sampleSlopes) {
    await prisma.slope.create({ data: slope });
  }
  console.log(`已创建 ${sampleSlopes.length} 条雪道档案`);
  
  for (const vehicle of sampleVehicles) {
    await prisma.vehicle.create({ data: vehicle });
  }
  console.log(`已创建 ${sampleVehicles.length} 台压雪车`);
  
  console.log('\n示例数据初始化完成！');
  console.log('\n雪道档案：');
  const slopes = await prisma.slope.findMany({ orderBy: { priority: 'asc' } });
  slopes.forEach(s => {
    const needsGrooming = s.currentSnowThickness < s.minSnowThickness;
    console.log(`  ${s.name} - ${s.difficulty} - 当前厚度:${s.currentSnowThickness}cm, 最小要求:${s.minSnowThickness}cm ${needsGrooming ? '[需要压雪]' : ''}`);
  });
  
  console.log('\n压雪车状态：');
  const vehicles = await prisma.vehicle.findMany();
  vehicles.forEach(v => {
    console.log(`  ${v.name} - ${v.model} - 状态:${v.status}`);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
