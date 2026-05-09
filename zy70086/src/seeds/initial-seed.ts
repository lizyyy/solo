import 'reflect-metadata';
import { initDatabase, AppDataSource } from '../database/data-source';
import { Bin, BinType, BinStatus, Vehicle, VehicleStatus } from '../entities';
import { v4 as uuidv4 } from 'uuid';

const communities = ['阳光花园', '翠湖苑', '金色家园', '东方明珠', '碧水湾'];
const locations = [
  '1号楼东侧', '1号楼西侧', '2号楼北侧', '2号楼南侧',
  '3号楼门口', '3号楼后方', '中心花园', '幼儿园旁',
  '停车场入口', '会所门口', '商业街北口', '商业街南口',
];

async function seedBins() {
  const binRepo = AppDataSource.getRepository(Bin);
  const existing = await binRepo.count();

  if (existing > 0) {
    console.log(`桶点数据已存在（${existing} 个），跳过初始化`);
    return;
  }

  const bins: Bin[] = [];
  const binTypes = [BinType.RECYCLABLE, BinType.KITCHEN, BinType.OTHER, BinType.HAZARDOUS];

  for (let i = 0; i < 20; i++) {
    const community = communities[Math.floor(Math.random() * communities.length)];
    const location = locations[Math.floor(Math.random() * locations.length)];
    const binType = binTypes[Math.floor(Math.random() * binTypes.length)];
    const fillLevel = Math.floor(Math.random() * 100);

    let status = BinStatus.NORMAL;
    let isUrgent = false;
    let consecutiveFullCount = 0;
    let lastFullAt = null;

    if (fillLevel >= 100) {
      status = BinStatus.OVERFLOW;
      isUrgent = true;
      consecutiveFullCount = Math.floor(Math.random() * 3) + 1;
      lastFullAt = new Date(Date.now() - Math.floor(Math.random() * 24) * 3600000);
    } else if (fillLevel >= 85) {
      status = BinStatus.FULL;
      isUrgent = true;
      consecutiveFullCount = Math.floor(Math.random() * 2) + 1;
      lastFullAt = new Date(Date.now() - Math.floor(Math.random() * 12) * 3600000);
    } else if (fillLevel >= 70) {
      status = BinStatus.NEAR_FULL;
    }

    bins.push(binRepo.create({
      community,
      location,
      binType,
      capacity: binType === BinType.KITCHEN ? 240 : 120,
      fillLevel,
      status,
      isUrgent,
      consecutiveFullCount,
      lastFullAt,
      lastClearedAt: fillLevel < 50 ? new Date(Date.now() - Math.floor(Math.random() * 48) * 3600000) : null,
      remark: null,
    }));
  }

  await binRepo.save(bins);
  console.log(`✓ 初始化桶点数据：${bins.length} 个`);

  const urgentCount = bins.filter((b) => b.isUrgent).length;
  const fullCount = bins.filter((b) => b.status === BinStatus.FULL).length;
  const overflowCount = bins.filter((b) => b.status === BinStatus.OVERFLOW).length;
  console.log(`  - 紧急桶点：${urgentCount} 个`);
  console.log(`  - 满溢桶点：${fullCount} 个`);
  console.log(`  - 溢漏桶点：${overflowCount} 个`);
}

async function seedVehicles() {
  const vehicleRepo = AppDataSource.getRepository(Vehicle);
  const existing = await vehicleRepo.count();

  if (existing > 0) {
    console.log(`车辆数据已存在（${existing} 个），跳过初始化`);
    return;
  }

  const vehicles = [
    {
      plateNumber: '京A·12345',
      model: '东风清运车',
      maxLoadWeight: 5000,
      driverName: '张师傅',
      driverPhone: '13800138001',
      currentLocation: '停车场',
    },
    {
      plateNumber: '京A·67890',
      model: '福田清运车',
      maxLoadWeight: 5000,
      driverName: '李师傅',
      driverPhone: '13800138002',
      currentLocation: '停车场',
    },
    {
      plateNumber: '京A·11111',
      model: '解放清运车',
      maxLoadWeight: 8000,
      driverName: '王师傅',
      driverPhone: '13800138003',
      currentLocation: '停车场',
    },
  ];

  const saved = await vehicleRepo.save(
    vehicles.map((v) =>
      vehicleRepo.create({
        ...v,
        status: VehicleStatus.IDLE,
        currentLoadWeight: 0,
        remark: null,
      }),
    ),
  );

  console.log(`✓ 初始化车辆数据：${saved.length} 个`);
  saved.forEach((v, i) => {
    console.log(`  - ${i + 1}. ${v.plateNumber}（${v.driverName}）- ${v.model}`);
  });
}

async function main() {
  console.log('\n========================================');
  console.log('  垃圾分类清运调度服务 - 数据初始化');
  console.log('========================================\n');

  try {
    await initDatabase();
    console.log('数据库连接成功\n');

    console.log('------------------------------');
    console.log('1. 初始化车辆数据');
    console.log('------------------------------');
    await seedVehicles();
    console.log('');

    console.log('------------------------------');
    console.log('2. 初始化桶点数据');
    console.log('------------------------------');
    await seedBins();
    console.log('');

    console.log('========================================');
    console.log('  数据初始化完成 ✓');
    console.log('========================================');
    console.log('\n快速开始：');
    console.log('  npm run dev          启动 API 服务');
    console.log('  npm run task:worker  启动后台任务处理器');
    console.log('\n查看首页：');
    console.log('  http://localhost:3000/');
    console.log('');

    process.exit(0);
  } catch (e) {
    console.error('数据初始化失败:', e);
    process.exit(1);
  }
}

main();
